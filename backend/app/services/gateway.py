"""OpenClaw Gateway WebSocket RPC client.

Implements the gateway v3 protocol:
  1. Connect to ws://host:port?token=<token>
  2. Receive connect.challenge event
  3. Send connect request with operator role
  4. Call RPC methods (chat.send, sessions.patch, wake, etc.)

This is the bridge between AgentCrab and the running OpenClaw agents.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from time import perf_counter
from typing import Any
from urllib.parse import urlencode, urlparse, urlunparse
from uuid import uuid4

log = logging.getLogger("agentcrab.gateway")

PROTOCOL_VERSION = 3
OPERATOR_SCOPES = (
    "operator.admin",
    "operator.approvals",
    "operator.pairing",
)


class GatewayError(RuntimeError):
    """Raised when gateway RPC calls fail."""


@dataclass(frozen=True)
class GatewayConfig:
    """Connection config for the OpenClaw gateway."""

    url: str  # e.g. ws://127.0.0.1:18789
    token: str | None = None


def build_ws_url(config: GatewayConfig) -> str:
    """Build the WebSocket URL with optional token query param."""
    base = (config.url or "").strip()
    if not base:
        raise GatewayError("Gateway URL is not configured")
    if not config.token:
        return base
    parsed = urlparse(base)
    query = urlencode({"token": config.token})
    return str(urlunparse(parsed._replace(query=query)))


# ── Low-level protocol ───────────────────────────────────────────────────────


async def _await_response(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    ws_recv,
    request_id: str,
    timeout: float = 30.0,
) -> Any:
    """Wait for a response matching request_id."""
    deadline = perf_counter() + timeout
    while perf_counter() < deadline:
        remaining = deadline - perf_counter()
        try:
            raw = await asyncio.wait_for(ws_recv(), timeout=remaining)
        except asyncio.TimeoutError:
            raise GatewayError(f"Timeout waiting for response to {request_id}")

        data = json.loads(raw)
        msg_type = data.get("type")
        msg_id = data.get("id")

        # Match response by ID
        if msg_type == "res" and msg_id == request_id:
            ok = data.get("ok")
            if ok is not None and not ok:
                error_msg = data.get("error", {}).get("message", "Gateway error")
                raise GatewayError(error_msg)
            return data.get("payload")

        if msg_id == request_id:
            if data.get("error"):
                raise GatewayError(data["error"].get("message", "Gateway error"))
            return data.get("result")

        # Ignore events and other messages
        log.debug("gateway.rpc.skip type=%s event=%s", msg_type, data.get("event"))

    raise GatewayError(f"Timeout waiting for response {request_id}")


async def _rpc_call_raw(ws_send, ws_recv, method: str, params: dict | None) -> Any:
    """Send an RPC request and return the response payload."""
    request_id = str(uuid4())
    message = {
        "type": "req",
        "id": request_id,
        "method": method,
        "params": params or {},
    }
    log.debug("gateway.rpc.send method=%s id=%s", method, request_id)
    await ws_send(json.dumps(message))
    return await _await_response(None, None, ws_recv, request_id)


def _connect_params(config: GatewayConfig) -> dict[str, Any]:
    """Build the connect handshake parameters."""
    params: dict[str, Any] = {
        "minProtocol": PROTOCOL_VERSION,
        "maxProtocol": PROTOCOL_VERSION,
        "role": "operator",
        "scopes": list(OPERATOR_SCOPES),
        "client": {
            "id": "agentcrab-mission-control",
            "version": "2.1.0",
            "platform": "server",
            "mode": "api",
        },
    }
    if config.token:
        params["auth"] = {"token": config.token}
    return params


async def gateway_call(
    method: str,
    params: dict[str, Any] | None = None,
    *,
    config: GatewayConfig,
    timeout: float = 30.0,
) -> Any:
    """Open a WebSocket, handshake, call a method, return result.

    Each call opens a fresh connection to keep things simple & safe.
    For high-frequency use, a connection pool could be added later.
    """
    try:
        import websockets  # type: ignore[import-untyped]
    except ImportError:
        raise GatewayError(
            "websockets package not installed. Run: pip install websockets"
        )

    url = build_ws_url(config)
    started = perf_counter()
    log.info("gateway.rpc.call method=%s", method)

    try:
        async with websockets.connect(url, ping_interval=None) as ws:
            # Step 1: receive connect.challenge (or timeout)
            try:
                first = await asyncio.wait_for(ws.recv(), timeout=3)
                data = json.loads(first)
                if data.get("event") != "connect.challenge":
                    log.warning("gateway.unexpected_first type=%s", data.get("type"))
            except asyncio.TimeoutError:
                log.debug("gateway.no_challenge (proceeding)")

            # Step 2: handshake
            connect_id = str(uuid4())
            await ws.send(json.dumps({
                "type": "req",
                "id": connect_id,
                "method": "connect",
                "params": _connect_params(config),
            }))
            await _await_response(None, None, ws.recv, connect_id, timeout=10)

            # Step 3: RPC call
            result = await _rpc_call_raw(ws.send, ws.recv, method, params)

            elapsed = int((perf_counter() - started) * 1000)
            log.info("gateway.rpc.ok method=%s elapsed=%dms", method, elapsed)
            return result

    except GatewayError:
        raise
    except Exception as exc:
        elapsed = int((perf_counter() - started) * 1000)
        log.error("gateway.rpc.fail method=%s elapsed=%dms error=%s", method, elapsed, exc)
        raise GatewayError(str(exc)) from exc


# ── High-level methods ───────────────────────────────────────────────────────


async def send_message(
    message: str,
    *,
    session_key: str,
    config: GatewayConfig,
    deliver: bool = False,
) -> Any:
    """Send a chat message to an agent session (non-blocking dispatch)."""
    return await gateway_call(
        "chat.send",
        {
            "sessionKey": session_key,
            "message": message,
            "deliver": deliver,
            "idempotencyKey": str(uuid4()),
        },
        config=config,
    )


async def ensure_session(
    session_key: str,
    *,
    config: GatewayConfig,
    label: str | None = None,
) -> Any:
    """Ensure an agent session exists."""
    params: dict[str, Any] = {"key": session_key}
    if label:
        params["label"] = label
    return await gateway_call("sessions.patch", params, config=config)


async def wake_agent(agent_id: str, *, config: GatewayConfig) -> Any:
    """Wake an agent (trigger next heartbeat immediately)."""
    return await gateway_call("wake", {"agentId": agent_id}, config=config)


async def list_sessions(*, config: GatewayConfig) -> Any:
    """List all gateway sessions."""
    return await gateway_call("sessions.list", config=config)


async def get_chat_history(
    session_key: str,
    *,
    config: GatewayConfig,
    limit: int | None = None,
) -> Any:
    """Fetch chat history for a session."""
    params: dict[str, Any] = {"sessionKey": session_key}
    if limit is not None:
        params["limit"] = limit
    return await gateway_call("chat.history", params, config=config)


async def get_agent_file(
    agent_id: str,
    filename: str,
    *,
    config: GatewayConfig,
) -> Any:
    """Read an agent workspace file via gateway."""
    return await gateway_call(
        "agents.files.get",
        {"agentId": agent_id, "name": filename},
        config=config,
    )


async def set_agent_file(
    agent_id: str,
    filename: str,
    content: str,
    *,
    config: GatewayConfig,
) -> Any:
    """Write to an agent workspace file via gateway."""
    return await gateway_call(
        "agents.files.set",
        {"agentId": agent_id, "name": filename, "content": content},
        config=config,
    )


async def gateway_health(*, config: GatewayConfig) -> Any:
    """Check gateway health."""
    return await gateway_call("health", config=config)
