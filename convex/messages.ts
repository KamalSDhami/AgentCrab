import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get messages for a task
export const listByTask = query({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("messages")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .collect();
    },
});

// Create a message/comment
export const create = mutation({
    args: {
        taskId: v.id("tasks"),
        fromAgentId: v.id("agents"),
        content: v.string(),
        attachments: v.optional(v.array(v.id("documents"))),
    },
    handler: async (ctx, args) => {
        const agent = await ctx.db.get(args.fromAgentId);
        const task = await ctx.db.get(args.taskId);
        if (!agent || !task) return;

        const messageId = await ctx.db.insert("messages", {
            taskId: args.taskId,
            fromAgentId: args.fromAgentId,
            content: args.content,
            attachments: args.attachments ?? [],
            createdAt: Date.now(),
        });

        // Log activity
        await ctx.db.insert("activities", {
            type: "message_sent",
            agentId: args.fromAgentId,
            taskId: args.taskId,
            message: `${agent.name} commented on "${task.title}"`,
            createdAt: Date.now(),
        });

        // Parse @mentions and create notifications
        const mentionRegex = /@(\w+)/g;
        let match;
        while ((match = mentionRegex.exec(args.content)) !== null) {
            const mentionedName = match[1];
            // Find agent by name
            const agents = await ctx.db.query("agents").collect();
            const mentionedAgent = agents.find(
                (a) => a.name.toLowerCase() === mentionedName.toLowerCase()
            );
            if (mentionedAgent) {
                await ctx.db.insert("notifications", {
                    mentionedAgentId: mentionedAgent._id,
                    sourceAgentId: args.fromAgentId,
                    taskId: args.taskId,
                    content: `${agent.name} mentioned you in "${task.title}": ${args.content.substring(0, 100)}...`,
                    delivered: false,
                    createdAt: Date.now(),
                });
            }
        }

        // Update task
        await ctx.db.patch(args.taskId, { updatedAt: Date.now() });

        return messageId;
    },
});
