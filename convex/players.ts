import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const join = mutation({
  args: {
    roomId: v.id("rooms"),
    name: v.string(),
    emoji: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { roomId, name, emoji, sessionId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");

    // Check if player already exists in this room
    const existing = await ctx.db
      .query("players")
      .withIndex("by_session_room", (q) =>
        q.eq("sessionId", sessionId).eq("roomId", roomId)
      )
      .first();
    if (existing) {
      // Reconnect
      await ctx.db.patch(existing._id, { isConnected: true, name, emoji });
      return existing._id;
    }

    const isInProgress = room.status !== "lobby";

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    // Late joiners become spectators
    return await ctx.db.insert("players", {
      roomId,
      name,
      emoji,
      score: 0,
      isHost: !isInProgress && players.length === 0,
      isConnected: true,
      sessionId,
      joinedAt: Date.now(),
      lastHeartbeat: Date.now(),
      isSpectator: isInProgress,
    });
  },
});

export const joinAsHost = internalMutation({
  args: {
    roomId: v.id("rooms"),
    name: v.string(),
    emoji: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { roomId, name, emoji, sessionId }) => {
    return await ctx.db.insert("players", {
      roomId,
      name,
      emoji,
      score: 0,
      isHost: true,
      isConnected: true,
      sessionId,
      joinedAt: Date.now(),
      lastHeartbeat: Date.now(),
      isSpectator: false,
    });
  },
});

export const getByRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
  },
});

export const getBySession = query({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, { sessionId, roomId }) => {
    return await ctx.db
      .query("players")
      .withIndex("by_session_room", (q) =>
        q.eq("sessionId", sessionId).eq("roomId", roomId)
      )
      .first();
  },
});

export const addScore = internalMutation({
  args: { playerId: v.id("players"), points: v.number() },
  handler: async (ctx, { playerId, points }) => {
    const player = await ctx.db.get(playerId);
    if (!player) return;
    await ctx.db.patch(playerId, { score: player.score + points });
  },
});
