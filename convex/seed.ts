import { mutation } from "./_generated/server";

// Seed the database with the 10 agents (enhanced with gateway fields)
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
                sessionKey: "agent:jarvis:main",
                level: "lead" as const,
                isBoardLead: true,
                openclawSessionId: "agent:jarvis:main",
                soulTemplate: "You are Jarvis, the Squad Lead. You coordinate the team, delegate tasks, and ensure quality.",
                identityProfile: { emoji: "🎖️", theme: "commander", description: "Squad Lead & Orchestrator" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "0,15,30,45 * * * *", message: "Heartbeat. Read WORKING.md." },
            },
            {
                name: "Shuri",
                role: "Product Analyst",
                sessionKey: "agent:shuri:main",
                level: "specialist" as const,
                openclawSessionId: "agent:shuri:main",
                soulTemplate: "You are Shuri, the Product Analyst. You research markets and analyze product strategy.",
                identityProfile: { emoji: "🔬", theme: "analyst", description: "Product & Market Analyst" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "3,18,33,48 * * * *", message: "Heartbeat check." },
            },
            {
                name: "Fury",
                role: "Customer Researcher",
                sessionKey: "agent:fury:main",
                level: "specialist" as const,
                openclawSessionId: "agent:fury:main",
                soulTemplate: "You are Fury, the Customer Researcher. You mine reviews, surveys, and support tickets.",
                identityProfile: { emoji: "🕵️", theme: "investigator", description: "Customer Intel & Research" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "5,20,35,50 * * * *", message: "Heartbeat check." },
            },
            {
                name: "Vision",
                role: "SEO Analyst",
                sessionKey: "agent:vision:main",
                level: "specialist" as const,
                openclawSessionId: "agent:vision:main",
                soulTemplate: "You are Vision, the SEO Analyst. You research keywords, analyze SERPs, and optimize content.",
                identityProfile: { emoji: "👁️", theme: "oracle", description: "SEO & Search Intelligence" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "7,22,37,52 * * * *", message: "Heartbeat check." },
            },
            {
                name: "Loki",
                role: "Content Writer",
                sessionKey: "agent:loki:main",
                level: "specialist" as const,
                openclawSessionId: "agent:loki:main",
                soulTemplate: "You are Loki, the Content Writer. You craft compelling blog posts, articles, and copy.",
                identityProfile: { emoji: "✍️", theme: "wordsmith", description: "Content & Copywriting" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "9,24,39,54 * * * *", message: "Heartbeat check." },
            },
            {
                name: "Quill",
                role: "Social Media Manager",
                sessionKey: "agent:quill:main",
                level: "specialist" as const,
                openclawSessionId: "agent:quill:main",
                soulTemplate: "You are Quill, the Social Media Manager. You create and schedule social content.",
                identityProfile: { emoji: "📱", theme: "influencer", description: "Social Media & Distribution" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "11,26,41,56 * * * *", message: "Heartbeat check." },
            },
            {
                name: "Wanda",
                role: "Designer",
                sessionKey: "agent:wanda:main",
                level: "specialist" as const,
                openclawSessionId: "agent:wanda:main",
                soulTemplate: "You are Wanda, the Designer. You create visual assets, banners, and design systems.",
                identityProfile: { emoji: "🎨", theme: "creative", description: "Visual Design & Assets" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "13,28,43,58 * * * *", message: "Heartbeat check." },
            },
            {
                name: "Pepper",
                role: "Email Marketing",
                sessionKey: "agent:pepper:main",
                level: "specialist" as const,
                openclawSessionId: "agent:pepper:main",
                soulTemplate: "You are Pepper, the Email Marketing Specialist. You create newsletters and email campaigns.",
                identityProfile: { emoji: "📧", theme: "strategist", description: "Email & Campaign Marketing" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "1,16,31,46 * * * *", message: "Heartbeat check." },
            },
            {
                name: "Friday",
                role: "Developer",
                sessionKey: "agent:friday:main",
                level: "specialist" as const,
                openclawSessionId: "agent:friday:main",
                soulTemplate: "You are Friday, the Developer. You build features, fix bugs, and maintain the codebase.",
                identityProfile: { emoji: "💻", theme: "engineer", description: "Development & Engineering" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "2,17,32,47 * * * *", message: "Heartbeat check." },
            },
            {
                name: "Wong",
                role: "Documentation",
                sessionKey: "agent:wong:main",
                level: "specialist" as const,
                openclawSessionId: "agent:wong:main",
                soulTemplate: "You are Wong, the Documentation Specialist. You maintain docs, wikis, and knowledge bases.",
                identityProfile: { emoji: "📚", theme: "librarian", description: "Documentation & Knowledge" },
                heartbeatConfig: { intervalMinutes: 15, cronExpression: "4,19,34,49 * * * *", message: "Heartbeat check." },
            },
        ];

        for (const agent of agents) {
            await ctx.db.insert("agents", {
                ...agent,
                status: "idle",
                lastSeen: Date.now(),
                provisionStatus: "confirmed",
                provisionedAt: Date.now(),
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
