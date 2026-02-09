import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const submit = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    round: v.number(),
    content: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("choice"),
      v.literal("rank"),
      v.literal("boolean")
    ),
  },
  handler: async (ctx, { roomId, playerId, round, content, type }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.status !== "playing") throw new Error("Game not in progress");

    // Check for existing submission
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", playerId).eq("round", round)
      )
      .first();
    if (existing) throw new Error("Already submitted");

    const player = await ctx.db.get(playerId);
    if (!player) throw new Error("Player not found");

    // For speed-answer rounds, check if correct and award time bonus
    const game = await ctx.db.get(room.gameId);
    if (!game) throw new Error("Game not found");
    const definition = JSON.parse(game.definition);
    const roundDef = definition.rounds[round];
    let bonusPoints = 0;

    if (roundDef?.type === "speed-answer" && roundDef.config?.answer) {
      const isCorrect =
        content.toLowerCase().trim() ===
        roundDef.config.answer.toLowerCase().trim();
      if (isCorrect && room.roundStartedAt) {
        const elapsed = (Date.now() - room.roundStartedAt) / 1000;
        bonusPoints = Math.max(0, Math.round((roundDef.timeLimit - elapsed) * 10));
        await ctx.runMutation(internal.players.addScore, {
          playerId,
          points: 100 + bonusPoints,
        });
      }
    }

    // For choice rounds, check correctness
    if (roundDef?.type === "choice" && roundDef.config?.correctIndex !== undefined) {
      const choiceIndex = parseInt(content);
      if (choiceIndex === roundDef.config.correctIndex) {
        const elapsed = room.roundStartedAt
          ? (Date.now() - room.roundStartedAt) / 1000
          : 0;
        bonusPoints = Math.max(0, Math.round((roundDef.timeLimit - elapsed) * 10));
        await ctx.runMutation(internal.players.addScore, {
          playerId,
          points: 100 + bonusPoints,
        });
      }
    }

    // For phaser-game and html-game rounds, parse the score and award points
    if (roundDef?.type === "phaser-game" || roundDef?.type === "html-game") {
      try {
        const parsed = JSON.parse(content);
        const gameScore = parsed.score || 0;
        if (gameScore > 0) {
          bonusPoints = gameScore;
          await ctx.runMutation(internal.players.addScore, {
            playerId,
            points: gameScore,
          });
        }
      } catch {
        // Invalid JSON, no points
      }
    }

    return await ctx.db.insert("submissions", {
      roomId,
      playerId,
      playerName: player.name,
      playerEmoji: player.emoji,
      round,
      content,
      type,
      votes: 0,
      bonusPoints,
      createdAt: Date.now(),
    });
  },
});

export const vote = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    submissionId: v.id("submissions"),
    round: v.number(),
  },
  handler: async (ctx, { roomId, playerId, submissionId, round }) => {
    // Check if already voted
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", playerId).eq("round", round)
      )
      .first();
    if (existing) throw new Error("Already voted this round");

    // Can't vote for your own submission
    const submission = await ctx.db.get(submissionId);
    if (!submission) throw new Error("Submission not found");
    if (submission.playerId === playerId) throw new Error("Can't vote for yourself");

    await ctx.db.insert("votes", { roomId, playerId, submissionId, round });
    await ctx.db.patch(submissionId, { votes: submission.votes + 1 });

    // Award points to the submission author
    await ctx.runMutation(internal.players.addScore, {
      playerId: submission.playerId,
      points: 50,
    });
  },
});

export const getByRound = query({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    return await ctx.db
      .query("submissions")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", roomId).eq("round", round)
      )
      .collect();
  },
});

export const getAllByRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    return await ctx.db
      .query("submissions")
      .withIndex("by_room_round", (q) => q.eq("roomId", roomId))
      .collect();
  },
});

export const getVotesByRound = query({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    return await ctx.db
      .query("votes")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", roomId).eq("round", round)
      )
      .collect();
  },
});

export const getPlayerVote = query({
  args: { playerId: v.id("players"), round: v.number() },
  handler: async (ctx, { playerId, round }) => {
    return await ctx.db
      .query("votes")
      .withIndex("by_player_round", (q) =>
        q.eq("playerId", playerId).eq("round", round)
      )
      .first();
  },
});

export const tallyMajority = mutation({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const subs = await ctx.db
      .query("submissions")
      .withIndex("by_room_round", (q) =>
        q.eq("roomId", roomId).eq("round", round)
      )
      .collect();

    // Count votes for each option
    const counts: Record<string, number> = {};
    for (const sub of subs) {
      counts[sub.content] = (counts[sub.content] || 0) + 1;
    }

    // Find majority
    let maxCount = 0;
    let majorityChoice = "";
    for (const [choice, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        majorityChoice = choice;
      }
    }

    // Award points to players who picked the majority
    for (const sub of subs) {
      if (sub.content === majorityChoice) {
        await ctx.runMutation(internal.players.addScore, {
          playerId: sub.playerId,
          points: 100,
        });
      }
    }

    return { majorityChoice, counts };
  },
});
