import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all agents
export const list = query({
    handler: async (ctx) => {
        return await ctx.db.query("agents").collect();
    },
});

// Get agent by ID
export const get = query({
    args: { id: v.id("agents") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

// Get agent by session key
export const getBySession = query({
    args: { sessionKey: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("agents")
            .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
            .first();
    },
});

// Get agent by OpenClaw session ID
export const getByOpenclawSession = query({
    args: { openclawSessionId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("agents")
            .withIndex("by_openclaw_session", (q) =>
                q.eq("openclawSessionId", args.openclawSessionId)
            )
            .first();
    },
});

// Create a new agent
export const create = mutation({
    args: {
        name: v.string(),
        role: v.string(),
        sessionKey: v.string(),
        level: v.union(v.literal("intern"), v.literal("specialist"), v.literal("lead")),
        avatar: v.optional(v.string()),
        openclawSessionId: v.optional(v.string()),
        gatewayId: v.optional(v.id("gateways")),
        isBoardLead: v.optional(v.boolean()),
        soulTemplate: v.optional(v.string()),
        identityProfile: v.optional(v.object({
            emoji: v.optional(v.string()),
            theme: v.optional(v.string()),
            description: v.optional(v.string()),
        })),
        heartbeatConfig: v.optional(v.object({
            intervalMinutes: v.optional(v.number()),
            cronExpression: v.optional(v.string()),
            message: v.optional(v.string()),
        })),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("agents", {
            ...args,
            status: "idle",
            lastSeen: Date.now(),
            provisionStatus: "confirmed",
            provisionedAt: Date.now(),
        });
    },
});

// Update agent status
export const updateStatus = mutation({
    args: {
        id: v.id("agents"),
        status: v.union(
            v.literal("idle"),
            v.literal("active"),
            v.literal("blocked"),
            v.literal("provisioning"),
            v.literal("offline")
        ),
        currentTaskId: v.optional(v.id("tasks")),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            status: args.status,
            currentTaskId: args.currentTaskId,
            lastSeen: Date.now(),
        });
    },
});

// Record agent heartbeat (updates lastSeen and optionally status)
export const heartbeat = mutation({
    args: {
        id: v.id("agents"),
        status: v.optional(v.union(
            v.literal("idle"),
            v.literal("active"),
            v.literal("blocked")
        )),
    },
    handler: async (ctx, args) => {
        const patch: Record<string, unknown> = { lastSeen: Date.now() };
        if (args.status) {
            patch.status = args.status;
        }
        await ctx.db.patch(args.id, patch);
    },
});

// Heartbeat or create agent (upsert pattern from reference project)
// OpenClaw agents call this to register themselves or update their heartbeat
export const heartbeatOrCreate = mutation({
    args: {
        sessionKey: v.string(),
        name: v.string(),
        role: v.optional(v.string()),
        status: v.optional(v.union(
            v.literal("idle"),
            v.literal("active"),
            v.literal("blocked")
        )),
        openclawSessionId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Try to find existing agent by session key
        const existing = await ctx.db
            .query("agents")
            .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
            .first();

        if (existing) {
            // Update heartbeat
            const patch: Record<string, unknown> = { lastSeen: Date.now() };
            if (args.status) patch.status = args.status;
            if (args.openclawSessionId) patch.openclawSessionId = args.openclawSessionId;
            await ctx.db.patch(existing._id, patch);

            // Log heartbeat activity
            await ctx.db.insert("activities", {
                type: "heartbeat",
                agentId: existing._id,
                message: `${existing.name} heartbeat OK`,
                createdAt: Date.now(),
            });

            return existing._id;
        }

        // Create new agent
        const agentId = await ctx.db.insert("agents", {
            name: args.name,
            role: args.role ?? "agent",
            sessionKey: args.sessionKey,
            level: "specialist",
            status: args.status ?? "idle",
            lastSeen: Date.now(),
            openclawSessionId: args.openclawSessionId,
            provisionStatus: "confirmed",
            provisionedAt: Date.now(),
        });

        // Log creation activity
        await ctx.db.insert("activities", {
            type: "agent_provisioned",
            agentId,
            message: `${args.name} has been provisioned and is online`,
            createdAt: Date.now(),
        });

        return agentId;
    },
});

// Update agent from gateway events (session binding, status, etc.)
export const updateFromGateway = mutation({
    args: {
        id: v.id("agents"),
        openclawSessionId: v.optional(v.string()),
        status: v.optional(v.union(
            v.literal("idle"),
            v.literal("active"),
            v.literal("blocked"),
            v.literal("provisioning"),
            v.literal("offline")
        )),
        soulTemplate: v.optional(v.string()),
        identityProfile: v.optional(v.object({
            emoji: v.optional(v.string()),
            theme: v.optional(v.string()),
            description: v.optional(v.string()),
        })),
        heartbeatConfig: v.optional(v.object({
            intervalMinutes: v.optional(v.number()),
            cronExpression: v.optional(v.string()),
            message: v.optional(v.string()),
        })),
        isBoardLead: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([, v]) => v !== undefined)
        );
        await ctx.db.patch(id, {
            ...filteredUpdates,
            lastSeen: Date.now(),
        });
    },
});

// Update agent SOUL template
export const updateSoul = mutation({
    args: {
        id: v.id("agents"),
        soulTemplate: v.string(),
    },
    handler: async (ctx, args) => {
        const agent = await ctx.db.get(args.id);
        if (!agent) return;

        await ctx.db.patch(args.id, {
            soulTemplate: args.soulTemplate,
        });

        await ctx.db.insert("activities", {
            type: "soul_updated",
            agentId: args.id,
            message: `${agent.name}'s SOUL template was updated`,
            createdAt: Date.now(),
        });
    },
});

// Update agent identity profile
export const updateIdentity = mutation({
    args: {
        id: v.id("agents"),
        identityProfile: v.object({
            emoji: v.optional(v.string()),
            theme: v.optional(v.string()),
            description: v.optional(v.string()),
        }),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            identityProfile: args.identityProfile,
        });
    },
});
