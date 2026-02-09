import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // Agent profiles and status
    agents: defineTable({
        name: v.string(),
        role: v.string(),
        status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
        currentTaskId: v.optional(v.id("tasks")),
        sessionKey: v.string(),
        level: v.union(v.literal("intern"), v.literal("specialist"), v.literal("lead")),
        avatar: v.optional(v.string()),
        lastSeen: v.optional(v.number()),
    }).index("by_session", ["sessionKey"]),

    // Task tracking
    tasks: defineTable({
        title: v.string(),
        description: v.string(),
        status: v.union(
            v.literal("inbox"),
            v.literal("assigned"),
            v.literal("in_progress"),
            v.literal("review"),
            v.literal("done"),
            v.literal("blocked")
        ),
        assigneeIds: v.array(v.id("agents")),
        createdBy: v.optional(v.id("agents")),
        tags: v.array(v.string()),
        priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_status", ["status"])
        .index("by_updated", ["updatedAt"]),

    // Comments on tasks
    messages: defineTable({
        taskId: v.id("tasks"),
        fromAgentId: v.id("agents"),
        content: v.string(),
        attachments: v.array(v.id("documents")),
        createdAt: v.number(),
    }).index("by_task", ["taskId"]),

    // Activity feed
    activities: defineTable({
        type: v.string(),
        agentId: v.id("agents"),
        taskId: v.optional(v.id("tasks")),
        message: v.string(),
        createdAt: v.number(),
    }).index("by_time", ["createdAt"]),

    // Documents and deliverables
    documents: defineTable({
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
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_task", ["taskId"]),

    // @mention notifications
    notifications: defineTable({
        mentionedAgentId: v.id("agents"),
        sourceAgentId: v.id("agents"),
        taskId: v.optional(v.id("tasks")),
        content: v.string(),
        delivered: v.boolean(),
        createdAt: v.number(),
    }).index("by_agent", ["mentionedAgentId", "delivered"])
        .index("by_undelivered", ["delivered"]),
});
