import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const send = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    emoji: v.string(),
  },
  handler: async (ctx, { roomId, playerId, emoji }) => {
    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Player not found");

    // Rate limit: max 1 reaction per second per player
    const recent = await ctx.db
      .query("reactions")
      .withIndex("by_room_recent", (q) => q.eq("roomId", roomId))
      .order("desc")
      .first();

    if (
      recent &&
      recent.playerId === playerId &&
      Date.now() - recent.createdAt < 1000
    ) {
      return; // Rate limited
    }

    return await ctx.db.insert("reactions", {
      roomId,
      playerId,
      playerName: player.name,
      playerEmoji: player.emoji,
      emoji,
      createdAt: Date.now(),
    });
  },
});

export const getRecent = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    // Get reactions from the last 10 seconds
    const cutoff = Date.now() - 10000;
    return await ctx.db
      .query("reactions")
      .withIndex("by_room_recent", (q) =>
        q.eq("roomId", roomId).gte("createdAt", cutoff)
      )
      .collect();
  },
});
