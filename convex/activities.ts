import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get recent activities
export const list = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const activities = await ctx.db
            .query("activities")
            .withIndex("by_time")
            .order("desc")
            .take(args.limit ?? 50);

        // Enrich with agent data
        const enriched = await Promise.all(
            activities.map(async (activity) => {
                const agent = await ctx.db.get(activity.agentId);
                return {
                    ...activity,
                    agentName: agent?.name ?? "Unknown",
                    agentRole: agent?.role ?? "Unknown",
                };
            })
        );

        return enriched;
    },
});

// Create activity entry
export const create = mutation({
    args: {
        type: v.string(),
        agentId: v.id("agents"),
        taskId: v.optional(v.id("tasks")),
        message: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("activities", {
            ...args,
            createdAt: Date.now(),
        });
    },
});
