import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all tasks, optionally filtered by status
export const list = query({
    args: { status: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (args.status) {
            return await ctx.db
                .query("tasks")
                .withIndex("by_status", (q) => q.eq("status", args.status as any))
                .collect();
        }
        return await ctx.db.query("tasks").order("desc").collect();
    },
});

// Get task by ID
export const get = query({
    args: { id: v.id("tasks") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

// Create a new task
export const create = mutation({
    args: {
        title: v.string(),
        description: v.string(),
        tags: v.array(v.string()),
        priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
        createdBy: v.optional(v.id("agents")),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const taskId = await ctx.db.insert("tasks", {
            title: args.title,
            description: args.description,
            status: "inbox",
            assigneeIds: [],
            createdBy: args.createdBy,
            tags: args.tags,
            priority: args.priority,
            createdAt: now,
            updatedAt: now,
        });

        // Log activity
        if (args.createdBy) {
            await ctx.db.insert("activities", {
                type: "task_created",
                agentId: args.createdBy,
                taskId,
                message: `Created task: ${args.title}`,
                createdAt: now,
            });
        }

        return taskId;
    },
});

// Update task status
export const updateStatus = mutation({
    args: {
        id: v.id("tasks"),
        status: v.union(
            v.literal("inbox"),
            v.literal("assigned"),
            v.literal("in_progress"),
            v.literal("review"),
            v.literal("done"),
            v.literal("blocked")
        ),
        agentId: v.optional(v.id("agents")),
    },
    handler: async (ctx, args) => {
        const task = await ctx.db.get(args.id);
        if (!task) return;

        await ctx.db.patch(args.id, {
            status: args.status,
            updatedAt: Date.now(),
        });

        // Log activity
        if (args.agentId) {
            await ctx.db.insert("activities", {
                type: "status_changed",
                agentId: args.agentId,
                taskId: args.id,
                message: `Changed status to ${args.status}: ${task.title}`,
                createdAt: Date.now(),
            });
        }
    },
});

// Assign agents to task (batch)
export const assignBatch = mutation({
    args: {
        id: v.id("tasks"),
        assigneeIds: v.array(v.id("agents")),
        assignedBy: v.optional(v.id("agents")),
    },
    handler: async (ctx, args) => {
        const task = await ctx.db.get(args.id);
        if (!task) return;

        await ctx.db.patch(args.id, {
            assigneeIds: args.assigneeIds,
            status: args.assigneeIds.length > 0 ? "assigned" : task.status,
            updatedAt: Date.now(),
        });

        // Log activity
        if (args.assignedBy) {
            await ctx.db.insert("activities", {
                type: "task_assigned",
                agentId: args.assignedBy,
                taskId: args.id,
                message: `Assigned task: ${task.title}`,
                createdAt: Date.now(),
            });
        }
    },
});

// Assign a single agent to task (adds to existing assignees)
export const assign = mutation({
    args: {
        id: v.id("tasks"),
        agentId: v.id("agents"),
    },
    handler: async (ctx, args) => {
        const task = await ctx.db.get(args.id);
        if (!task) return;

        const agent = await ctx.db.get(args.agentId);
        if (!agent) return;

        // Add to assignees if not already assigned
        const newAssignees = task.assigneeIds.includes(args.agentId)
            ? task.assigneeIds
            : [...task.assigneeIds, args.agentId];

        await ctx.db.patch(args.id, {
            assigneeIds: newAssignees,
            status: newAssignees.length > 0 && task.status === "inbox" ? "assigned" : task.status,
            updatedAt: Date.now(),
        });

        // Wake up the agent - set to active
        await ctx.db.patch(args.agentId, {
            status: "active",
            currentTaskId: args.id,
            lastSeen: Date.now(),
        });

        // Log activity
        await ctx.db.insert("activities", {
            type: "task_assigned",
            agentId: args.agentId,
            taskId: args.id,
            message: `Was assigned to: ${task.title}`,
            createdAt: Date.now(),
        });
    },
});

// Update task details
export const update = mutation({
    args: {
        id: v.id("tasks"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
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
