import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get undelivered notifications for an agent
export const getUndelivered = query({
    args: { agentId: v.id("agents") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("notifications")
            .withIndex("by_agent", (q) =>
                q.eq("mentionedAgentId", args.agentId).eq("delivered", false)
            )
            .collect();
    },
});

// Get all undelivered notifications (for daemon)
export const getAllUndelivered = query({
    handler: async (ctx) => {
        return await ctx.db
            .query("notifications")
            .withIndex("by_undelivered", (q) => q.eq("delivered", false))
            .collect();
    },
});

// Mark notification as delivered
export const markDelivered = mutation({
    args: { id: v.id("notifications") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { delivered: true });
    },
});

// Create notification (used for @all mentions)
export const create = mutation({
    args: {
        mentionedAgentId: v.id("agents"),
        sourceAgentId: v.id("agents"),
        taskId: v.optional(v.id("tasks")),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("notifications", {
            ...args,
            delivered: false,
            createdAt: Date.now(),
        });
    },
});

// Notify all agents (@all)
export const notifyAll = mutation({
    args: {
        sourceAgentId: v.id("agents"),
        taskId: v.optional(v.id("tasks")),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const agents = await ctx.db.query("agents").collect();
        const now = Date.now();

        for (const agent of agents) {
            if (agent._id !== args.sourceAgentId) {
                await ctx.db.insert("notifications", {
                    mentionedAgentId: agent._id,
                    sourceAgentId: args.sourceAgentId,
                    taskId: args.taskId,
                    content: args.content,
                    delivered: false,
                    createdAt: now,
                });
            }
        }
    },
});
