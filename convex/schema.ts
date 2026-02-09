import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    prompt: v.string(),
    title: v.string(),
    tagline: v.string(),
    definition: v.string(),
    themeEmoji: v.string(),
    themeMood: v.string(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  rooms: defineTable({
    gameId: v.id("games"),
    code: v.string(),
    hostSessionId: v.string(),
    status: v.union(
      v.literal("lobby"),
      v.literal("playing"),
      v.literal("finished")
    ),
    currentRound: v.number(),
    roundPhase: v.union(
      v.literal("intro"),
      v.literal("submit"),
      v.literal("vote"),
      v.literal("reveal"),
      v.literal("scores")
    ),
    roundStartedAt: v.optional(v.number()),
    rematchCode: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_game", ["gameId"]),

  players: defineTable({
    roomId: v.id("rooms"),
    name: v.string(),
    emoji: v.string(),
    score: v.number(),
    isHost: v.boolean(),
    isConnected: v.boolean(),
    sessionId: v.string(),
    joinedAt: v.number(),
    lastHeartbeat: v.optional(v.number()),
    isSpectator: v.optional(v.boolean()),
  })
    .index("by_room", ["roomId"])
    .index("by_session_room", ["sessionId", "roomId"]),

  submissions: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    playerName: v.string(),
    playerEmoji: v.string(),
    round: v.number(),
    content: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("choice"),
      v.literal("rank"),
      v.literal("boolean")
    ),
    votes: v.number(),
    bonusPoints: v.number(),
    createdAt: v.number(),
  })
    .index("by_room_round", ["roomId", "round"])
    .index("by_player_round", ["playerId", "round"]),

  votes: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    submissionId: v.id("submissions"),
    round: v.number(),
  })
    .index("by_room_round", ["roomId", "round"])
    .index("by_player_round", ["playerId", "round"]),

  reactions: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    playerName: v.string(),
    playerEmoji: v.string(),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_recent", ["roomId", "createdAt"]),

  playerPositions: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    playerName: v.string(),
    playerEmoji: v.string(),
    x: v.number(),
    y: v.number(),
    velocityX: v.number(),
    velocityY: v.number(),
    animation: v.string(),
    color: v.string(),
    round: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room_round", ["roomId", "round"])
    .index("by_player_round", ["playerId", "round"]),
});
