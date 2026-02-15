"""Thread-safe JSON file I/O with atomic writes."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

_locks: dict[str, threading.Lock] = {}
_global_lock = threading.Lock()


def _get_lock(path: str) -> threading.Lock:
    with _global_lock:
        if path not in _locks:
            _locks[path] = threading.Lock()
        return _locks[path]


def read_json(path: Path) -> Any:
    """Read and parse a JSON file. Returns None if missing."""
    if not path.exists():
        return None
    with _get_lock(str(path)):
        return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    """Atomically write JSON data (write to .tmp then rename)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with _get_lock(str(path)):
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(
            json.dumps(data, indent=2, default=str) + "\n", encoding="utf-8"
        )
        tmp.replace(path)


def read_table(mc_root: str, name: str) -> list[dict[str, Any]]:
    """Read a mission-control JSON table, always returning a list."""
    data = read_json(Path(mc_root) / name)
    return data if isinstance(data, list) else []


def write_table(mc_root: str, name: str, rows: list[dict[str, Any]]) -> None:
    """Write a mission-control JSON table."""
    write_json(Path(mc_root) / name, rows)
