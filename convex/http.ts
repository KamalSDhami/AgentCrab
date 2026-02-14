import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// ─── Agent Heartbeat Endpoint ───────────────────────────────────────
// POST /api/agent/heartbeat
// Body: { sessionKey, name, role?, status?, openclawSessionId? }
// Returns: { agentId, status: "ok" }
http.route({
    path: "/api/agent/heartbeat",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const body = await request.json();
            const { sessionKey, name, role, status, openclawSessionId } = body;

            if (!sessionKey || !name) {
                return new Response(
                    JSON.stringify({ error: "sessionKey and name are required" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            const agentId = await ctx.runMutation(api.agents.heartbeatOrCreate, {
                sessionKey,
                name,
                role: role ?? undefined,
                status: status ?? undefined,
                openclawSessionId: openclawSessionId ?? undefined,
            });

            return new Response(
                JSON.stringify({ agentId, status: "ok" }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        } catch (error) {
            return new Response(
                JSON.stringify({ error: String(error) }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }),
});

// ─── Agent Status Update Endpoint ───────────────────────────────────
// POST /api/agent/status
// Body: { sessionKey, status }
http.route({
    path: "/api/agent/status",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const body = await request.json();
            const { sessionKey, status } = body;

            if (!sessionKey || !status) {
                return new Response(
                    JSON.stringify({ error: "sessionKey and status are required" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            // Look up agent by session key
            const agent = await ctx.runQuery(api.agents.getBySession, { sessionKey });
            if (!agent) {
                return new Response(
                    JSON.stringify({ error: "Agent not found" }),
                    { status: 404, headers: { "Content-Type": "application/json" } }
                );
            }

            await ctx.runMutation(api.agents.updateStatus, {
                id: agent._id,
                status,
            });

            return new Response(
                JSON.stringify({ status: "ok" }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        } catch (error) {
            return new Response(
                JSON.stringify({ error: String(error) }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }),
});

// ─── Agent Task Update Endpoint ─────────────────────────────────────
// POST /api/agent/task/update
// Body: { sessionKey, taskId, status, comment? }
http.route({
    path: "/api/agent/task/update",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const body = await request.json();
            const { sessionKey, taskId, status, comment } = body;

            if (!sessionKey || !taskId || !status) {
                return new Response(
                    JSON.stringify({ error: "sessionKey, taskId, and status are required" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            // Look up agent
            const agent = await ctx.runQuery(api.agents.getBySession, { sessionKey });
            if (!agent) {
                return new Response(
                    JSON.stringify({ error: "Agent not found" }),
                    { status: 404, headers: { "Content-Type": "application/json" } }
                );
            }

            // Update task status
            await ctx.runMutation(api.tasks.updateStatus, {
                id: taskId,
                status,
                agentId: agent._id,
            });

            // Post comment if provided
            if (comment) {
                await ctx.runMutation(api.messages.create, {
                    taskId,
                    fromAgentId: agent._id,
                    content: comment,
                });
            }

            return new Response(
                JSON.stringify({ status: "ok" }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        } catch (error) {
            return new Response(
                JSON.stringify({ error: String(error) }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }),
});

// ─── Agent Comment Endpoint ─────────────────────────────────────────
// POST /api/agent/comment
// Body: { sessionKey, taskId, content }
http.route({
    path: "/api/agent/comment",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        try {
            const body = await request.json();
            const { sessionKey, taskId, content } = body;

            if (!sessionKey || !taskId || !content) {
                return new Response(
                    JSON.stringify({ error: "sessionKey, taskId, and content are required" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            const agent = await ctx.runQuery(api.agents.getBySession, { sessionKey });
            if (!agent) {
                return new Response(
                    JSON.stringify({ error: "Agent not found" }),
                    { status: 404, headers: { "Content-Type": "application/json" } }
                );
            }

            await ctx.runMutation(api.messages.create, {
                taskId,
                fromAgentId: agent._id,
                content,
            });

            return new Response(
                JSON.stringify({ status: "ok" }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        } catch (error) {
            return new Response(
                JSON.stringify({ error: String(error) }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }),
});

// ─── List Agents Endpoint (GET) ─────────────────────────────────────
// GET /api/agents
http.route({
    path: "/api/agents",
    method: "GET",
    handler: httpAction(async (ctx) => {
        try {
            const agents = await ctx.runQuery(api.agents.list);
            return new Response(
                JSON.stringify({ agents, count: agents.length }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        } catch (error) {
            return new Response(
                JSON.stringify({ error: String(error) }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }
    }),
});

// ─── CORS preflight handler ─────────────────────────────────────────
http.route({
    path: "/api/agent/heartbeat",
    method: "OPTIONS",
    handler: httpAction(async () => {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

http.route({
    path: "/api/agent/status",
    method: "OPTIONS",
    handler: httpAction(async () => {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

http.route({
    path: "/api/agent/task/update",
    method: "OPTIONS",
    handler: httpAction(async () => {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

http.route({
    path: "/api/agent/comment",
    method: "OPTIONS",
    handler: httpAction(async () => {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

http.route({
    path: "/api/agents",
    method: "OPTIONS",
    handler: httpAction(async () => {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

export default http;
