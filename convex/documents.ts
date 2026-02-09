import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all documents
export const list = query({
    handler: async (ctx) => {
        return await ctx.db.query("documents").order("desc").collect();
    },
});

// Get documents by task
export const listByTask = query({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("documents")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .collect();
    },
});

// Get document by ID
export const get = query({
    args: { id: v.id("documents") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

// Create a document
export const create = mutation({
    args: {
        title: v.string(),
        content: v.string(),
        type: v.union(
            v.literal("deliverable"),
            v.literal("research"),
            v.literal("protocol"),
            v.literal("other")
        ),
        taskId: v.optional(v.id("tasks")),
        authorId: v.id("agents"),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const docId = await ctx.db.insert("documents", {
            ...args,
            createdAt: now,
            updatedAt: now,
        });

        // Log activity
        const agent = await ctx.db.get(args.authorId);
        await ctx.db.insert("activities", {
            type: "document_created",
            agentId: args.authorId,
            taskId: args.taskId,
            message: `${agent?.name ?? "Agent"} created document: ${args.title}`,
            createdAt: now,
        });

        return docId;
    },
});

// Update document
export const update = mutation({
    args: {
        id: v.id("documents"),
        title: v.optional(v.string()),
        content: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );

        await ctx.db.patch(id, {
            ...filteredUpdates,
            updatedAt: Date.now(),
        });
    },
});
