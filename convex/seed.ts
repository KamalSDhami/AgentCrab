import { mutation } from "./_generated/server";

// Seed the database with the 10 agents
export const seedAgents = mutation({
    handler: async (ctx) => {
        // Check if agents already exist
        const existing = await ctx.db.query("agents").first();
        if (existing) {
            return { message: "Agents already seeded", count: 0 };
        }

        const agents = [
            {
                name: "Jarvis",
                role: "Squad Lead",
                sessionKey: "agent:main:main",
                level: "lead" as const,
            },
            {
                name: "Shuri",
                role: "Product Analyst",
                sessionKey: "agent:product-analyst:main",
                level: "specialist" as const,
            },
            {
                name: "Fury",
                role: "Customer Researcher",
                sessionKey: "agent:customer-researcher:main",
                level: "specialist" as const,
            },
            {
                name: "Vision",
                role: "SEO Analyst",
                sessionKey: "agent:seo-analyst:main",
                level: "specialist" as const,
            },
            {
                name: "Loki",
                role: "Content Writer",
                sessionKey: "agent:content-writer:main",
                level: "specialist" as const,
            },
            {
                name: "Quill",
                role: "Social Media Manager",
                sessionKey: "agent:social-media-manager:main",
                level: "specialist" as const,
            },
            {
                name: "Wanda",
                role: "Designer",
                sessionKey: "agent:designer:main",
                level: "specialist" as const,
            },
            {
                name: "Pepper",
                role: "Email Marketing",
                sessionKey: "agent:email-marketing:main",
                level: "specialist" as const,
            },
            {
                name: "Friday",
                role: "Developer",
                sessionKey: "agent:developer:main",
                level: "specialist" as const,
            },
            {
                name: "Wong",
                role: "Documentation",
                sessionKey: "agent:notion-agent:main",
                level: "specialist" as const,
            },
        ];

        for (const agent of agents) {
            await ctx.db.insert("agents", {
                ...agent,
                status: "idle",
                lastSeen: Date.now(),
            });
        }

        return { message: "Agents seeded successfully", count: agents.length };
    },
});

// Create sample tasks for testing
export const seedTasks = mutation({
    handler: async (ctx) => {
        const agents = await ctx.db.query("agents").collect();
        if (agents.length === 0) {
            return { message: "Seed agents first", count: 0 };
        }

        const jarvis = agents.find(a => a.name === "Jarvis");
        const vision = agents.find(a => a.name === "Vision");
        const loki = agents.find(a => a.name === "Loki");
        const fury = agents.find(a => a.name === "Fury");

        const now = Date.now();

        const tasks = [
            {
                title: "Competitor Analysis Dashboard",
                description: "Build a comparison page with SEO research, customer quotes, and polished copy",
                status: "inbox" as const,
                assigneeIds: [],
                tags: ["research", "content"],
                priority: "high" as const,
                createdAt: now,
                updatedAt: now,
            },
            {
                title: "SEO Keyword Research",
                description: "Analyze target keywords and search intent for the new blog content strategy",
                status: "assigned" as const,
                assigneeIds: vision ? [vision._id] : [],
                tags: ["seo", "research"],
                priority: "medium" as const,
                createdAt: now - 86400000,
                updatedAt: now - 3600000,
            },
            {
                title: "Write Blog Post: AI Chatbots",
                description: "Create comprehensive guide on AI chatbots for customer support",
                status: "in_progress" as const,
                assigneeIds: loki ? [loki._id] : [],
                tags: ["content", "blog"],
                priority: "high" as const,
                createdAt: now - 172800000,
                updatedAt: now - 1800000,
            },
            {
                title: "Customer Research: G2 Reviews",
                description: "Mine G2 reviews for customer pain points and quotes",
                status: "review" as const,
                assigneeIds: fury ? [fury._id] : [],
                tags: ["research", "customer"],
                createdAt: now - 259200000,
                updatedAt: now - 7200000,
            },
        ];

        for (const task of tasks) {
            const taskId = await ctx.db.insert("tasks", task);

            // Log activity
            if (jarvis) {
                await ctx.db.insert("activities", {
                    type: "task_created",
                    agentId: jarvis._id,
                    taskId,
                    message: `Created task: ${task.title}`,
                    createdAt: task.createdAt,
                });
            }
        }

        return { message: "Tasks seeded successfully", count: tasks.length };
    },
});
