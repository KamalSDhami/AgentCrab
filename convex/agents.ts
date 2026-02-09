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

// Create a new agent
export const create = mutation({
    args: {
        name: v.string(),
        role: v.string(),
        sessionKey: v.string(),
        level: v.union(v.literal("intern"), v.literal("specialist"), v.literal("lead")),
        avatar: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("agents", {
            ...args,
            status: "idle",
            lastSeen: Date.now(),
        });
    },
});

// Update agent status
export const updateStatus = mutation({
    args: {
        id: v.id("agents"),
        status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
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

// Record agent heartbeat
export const heartbeat = mutation({
    args: { id: v.id("agents") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            lastSeen: Date.now(),
        });
    },
});
