"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useSessionId } from "../../providers";
import { Lobby } from "@/components/Lobby";
import { GameShell } from "@/components/GameShell";
import { GameResults } from "@/components/GameResults";
import { JoinForm } from "@/components/JoinForm";
import { motion } from "framer-motion";
import Link from "next/link";
import { Id } from "../../../convex/_generated/dataModel";

export default function PlayPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();
  const sessionId = useSessionId();

  const room = useQuery(api.rooms.getByCode, code ? { code } : "skip");
  const players = useQuery(
    api.players.getByRoom,
    room ? { roomId: room._id } : "skip"
  );
  const currentPlayer = useQuery(
    api.players.getBySession,
    room && sessionId
      ? { sessionId, roomId: room._id }
      : "skip"
  );
  const game = useQuery(api.games.get, room ? { id: room.gameId } : "skip");

  // Loading state
  if (room === undefined || !sessionId) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-text-muted text-lg"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  // Room not found
  if (room === null) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 space-y-6">
        <div className="text-6xl">🫠</div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-display font-bold">Room not found</h1>
          <p className="text-text-muted">
            The code <span className="font-mono font-bold text-text">{code}</span> doesn't match any active game.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/join"
            className="px-5 py-2.5 bg-surface-light text-text rounded-xl font-semibold hover:bg-surface-hover transition-colors"
          >
            Try another code
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors"
          >
            Create a game
          </Link>
        </div>
      </div>
    );
  }

  // Need to join
  if (!currentPlayer) {
    return (
      <JoinForm
        roomId={room._id}
        roomCode={code}
        sessionId={sessionId}
        gameTitle={game?.title}
        gameEmoji={game?.themeEmoji}
        playerCount={players?.length ?? 0}
        isLobby={room.status === "lobby"}
      />
    );
  }

  // Game states
  const gameDefinition = game ? JSON.parse(game.definition) : null;

  if (!game || !gameDefinition) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-text-muted text-lg"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  if (room.status === "lobby") {
    return (
      <Lobby
        room={room}
        game={game}
        gameDefinition={gameDefinition}
        players={players ?? []}
        currentPlayer={currentPlayer}
        sessionId={sessionId}
      />
    );
  }

  if (room.status === "playing" && gameDefinition) {
    return (
      <GameShell
        room={room}
        gameDefinition={gameDefinition}
        players={players ?? []}
        currentPlayer={currentPlayer}
        sessionId={sessionId}
      />
    );
  }

  if (room.status === "finished") {
    return (
      <GameResults
        room={room}
        game={game!}
        gameDefinition={gameDefinition}
        players={players ?? []}
        currentPlayer={currentPlayer}
      />
    );
  }

  return null;
}
