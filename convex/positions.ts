import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const updatePosition = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    x: v.number(),
    y: v.number(),
    velocityX: v.number(),
    velocityY: v.number(),
    animation: v.string(),
    round: v.number(),
  },
  handler: async (ctx, args) => {
    // Find existing position record for this player in this round
    const existing = await ctx.db
      .query("playerPositions")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", args.playerId).eq("round", args.round)
      )
      .first();

    const player = await ctx.db.get(args.playerId);
    if (!player) return;

    // Determine player color based on order in room
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    const playerIndex = players.findIndex((p) => p._id === args.playerId);
    const colors = [
      "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
      "#1abc9c", "#e91e63", "#ff9800", "#00bcd4", "#8bc34a",
      "#ff5722", "#607d8b",
    ];
    const color = colors[playerIndex % colors.length];

    if (existing) {
      await ctx.db.patch(existing._id, {
        x: args.x,
        y: args.y,
        velocityX: args.velocityX,
        velocityY: args.velocityY,
        animation: args.animation,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("playerPositions", {
        roomId: args.roomId,
        playerId: args.playerId,
        playerName: player.name,
        playerEmoji: player.emoji,
        x: args.x,
        y: args.y,
        velocityX: args.velocityX,
        velocityY: args.velocityY,
        animation: args.animation,
        color,
        round: args.round,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getPositions = query({
  args: {
    roomId: v.id("rooms"),
    round: v.number(),
  },
  handler: async (ctx, { roomId, round }) => {
    return await ctx.db
      .query("playerPositions")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", roomId).eq("round", round)
      )
      .collect();
  },
});

export const clearPositions = mutation({
  args: {
    roomId: v.id("rooms"),
    round: v.number(),
  },
  handler: async (ctx, { roomId, round }) => {
    const positions = await ctx.db
      .query("playerPositions")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", roomId).eq("round", round)
      )
      .collect();

    for (const pos of positions) {
      await ctx.db.delete(pos._id);
    }
  },
});
