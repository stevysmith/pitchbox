import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const create = internalMutation({
  args: {
    gameId: v.id("games"),
    code: v.string(),
    hostSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("rooms", {
      ...args,
      status: "lobby",
      currentRound: 0,
      roundPhase: "intro",
      createdAt: Date.now(),
    });
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();
  },
});

export const startGame = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostSessionId !== sessionId) throw new Error("Only the host can start");
    if (room.status !== "lobby") throw new Error("Game already started");

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    if (players.length < 2) throw new Error("Need at least 2 players");

    await ctx.db.patch(roomId, {
      status: "playing",
      currentRound: 0,
      roundPhase: "intro",
      roundStartedAt: Date.now(),
    });
  },
});

export const advancePhase = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostSessionId !== sessionId) throw new Error("Only the host can advance");
    if (room.status !== "playing") return;

    const game = await ctx.db.get(room.gameId);
    if (!game) throw new Error("Game not found");
    const definition = JSON.parse(game.definition);
    const totalRounds = definition.rounds.length;
    const currentRound = definition.rounds[room.currentRound];

    const phaseOrder: Record<string, string> = {
      intro: "submit",
      submit: needsVoting(currentRound?.type) ? "vote" : "reveal",
      vote: "reveal",
      reveal: "scores",
    };

    const nextPhase = phaseOrder[room.roundPhase];

    if (!nextPhase || room.roundPhase === "scores") {
      // Move to next round
      const nextRound = room.currentRound + 1;
      if (nextRound >= totalRounds) {
        // Game over
        await ctx.db.patch(roomId, {
          status: "finished",
          roundPhase: "reveal",
        });
      } else {
        await ctx.db.patch(roomId, {
          currentRound: nextRound,
          roundPhase: "intro",
          roundStartedAt: Date.now(),
        });
      }
    } else {
      await ctx.db.patch(roomId, {
        roundPhase: nextPhase as any,
        roundStartedAt: Date.now(),
      });
    }
  },
});

function needsVoting(roundType?: string): boolean {
  if (roundType === "phaser-game" || roundType === "html-game") return false;
  return ["creative-prompt", "caption", "emoji-story"].includes(roundType ?? "");
}

export const transferHost = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");

    // Find requesting player
    const player = await ctx.db
      .query("players")
      .withIndex("by_session_room", (q) =>
        q.eq("sessionId", sessionId).eq("roomId", roomId)
      )
      .first();
    if (!player) throw new Error("Player not found");

    // Check that current host is disconnected (no heartbeat for 30s)
    const currentHost = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .filter((q) => q.eq(q.field("isHost"), true))
      .first();

    if (currentHost) {
      const lastBeat = currentHost.lastHeartbeat || currentHost.joinedAt;
      if (Date.now() - lastBeat < 30000) {
        throw new Error("Current host is still connected");
      }
      // Demote old host
      await ctx.db.patch(currentHost._id, { isHost: false });
    }

    // Promote new host
    await ctx.db.patch(player._id, { isHost: true });
    await ctx.db.patch(roomId, { hostSessionId: sessionId });
  },
});

export const playerHeartbeat = mutation({
  args: { roomId: v.id("rooms"), sessionId: v.string() },
  handler: async (ctx, { roomId, sessionId }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_session_room", (q) =>
        q.eq("sessionId", sessionId).eq("roomId", roomId)
      )
      .first();
    if (player) {
      await ctx.db.patch(player._id, {
        lastHeartbeat: Date.now(),
        isConnected: true,
      });
    }
  },
});

export const setRematchCode = mutation({
  args: { roomId: v.id("rooms"), rematchCode: v.string() },
  handler: async (ctx, { roomId, rematchCode }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    await ctx.db.patch(roomId, { rematchCode });
  },
});

export const getByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_game", (q) => q.eq("gameId", gameId))
      .order("desc")
      .first();
  },
});
