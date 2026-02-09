import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const create = internalMutation({
  args: {
    prompt: v.string(),
    title: v.string(),
    tagline: v.string(),
    definition: v.string(),
    themeEmoji: v.string(),
    themeMood: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("games", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { id: v.id("games") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("games")
      .withIndex("by_created")
      .order("desc")
      .take(limit ?? 20);
  },
});
