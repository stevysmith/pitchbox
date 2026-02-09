"use client";

import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { GameDefinition } from "@/lib/gameTypes";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface LobbyProps {
  room: Doc<"rooms">;
  game: Doc<"games">;
  gameDefinition: GameDefinition;
  players: Doc<"players">[];
  currentPlayer: Doc<"players">;
  sessionId: string;
}

export function Lobby({
  room,
  game,
  gameDefinition,
  players,
  currentPlayer,
  sessionId,
}: LobbyProps) {
  const startGame = useMutation(api.rooms.startGame);
  const isHost = currentPlayer.isHost;

  const handleStart = async () => {
    try {
      await startGame({ roomId: room._id, sessionId });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const sceneTypeLabels: Record<string, string> = {
    runner: "🏃 Runner",
    arena: "⚔️ Arena",
    platformer: "🕹️ Platformer",
    dodge: "☄️ Dodge",
    shooter: "🎯 Shooter",
    puzzle: "🧩 Puzzle",
    catcher: "🧺 Catcher",
    climber: "⬆️ Climber",
    memory: "🧠 Memory",
    sumo: "💪 Sumo",
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          <span className="font-display font-bold text-xl text-text">
            pitch.box
          </span>
        </Link>
        <div className="flex items-center gap-2 bg-surface-light rounded-lg px-3 py-1.5">
          <span className="text-xs text-text-muted">Room</span>
          <span className="font-mono font-bold text-accent text-lg tracking-wider">
            {room.code}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-8 max-w-lg mx-auto w-full">
        {/* Game Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2 mb-8"
        >
          <div className="text-5xl mb-2">{gameDefinition.theme?.emoji ?? "🎮"}</div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            {gameDefinition.title}
          </h1>
          <p className="text-text-muted text-lg">{gameDefinition.tagline}</p>
        </motion.div>

        {/* Round Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full mb-6"
        >
          <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
            {gameDefinition.rounds.map((round, i) => (
              <div
                key={i}
                className="flex-shrink-0 glass rounded-lg px-3 py-2 space-y-0.5"
              >
                <div className="text-xs text-text-dim">Round {i + 1}</div>
                <div className="text-sm font-medium text-text whitespace-nowrap">
                  {sceneTypeLabels[round.config?.sceneType as string] || "🎮 Game"}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Players */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full space-y-3 mb-8"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-dim uppercase tracking-wider">
              Players ({players.length})
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-go opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-go"></span>
              </span>
              <span className="text-xs text-go">Waiting for players</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {players.map((player, i) => (
              <motion.div
                key={player._id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * i }}
                className={cn(
                  "glass rounded-xl p-3 flex items-center gap-3",
                  player._id === currentPlayer._id && "ring-1 ring-accent/50"
                )}
              >
                <span className="text-2xl">{player.emoji}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-text truncate text-sm">
                    {player.name}
                    {player._id === currentPlayer._id && (
                      <span className="text-accent ml-1">(you)</span>
                    )}
                  </div>
                  {player.isHost && (
                    <span className="text-xs text-warn font-medium">Host</span>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, 4 - players.length) }).map(
              (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="rounded-xl border-2 border-dashed border-surface-light p-3 flex items-center justify-center"
                >
                  <span className="text-text-dim text-sm">Waiting...</span>
                </div>
              )
            )}
          </div>
        </motion.div>

        {/* Share & Start */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full space-y-3"
        >
          {/* Share Instructions */}
          <div className="glass rounded-xl p-4 text-center space-y-2">
            <p className="text-text-muted text-sm">
              Share this code with your team
            </p>
            <button
              onClick={() => {
                const url = window.location.href;
                if (navigator.share) {
                  navigator.share({ title: gameDefinition.title, url });
                } else {
                  navigator.clipboard.writeText(url);
                }
              }}
              className="font-mono text-4xl font-bold text-accent tracking-[0.3em] hover:text-accent-light transition-colors"
            >
              {room.code}
            </button>
            <p className="text-xs text-text-dim">tap to copy link</p>
          </div>

          {/* Start Button (host only) */}
          {isHost ? (
            <button
              onClick={handleStart}
              disabled={players.length < 2}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98]",
                players.length >= 2
                  ? "bg-gradient-to-r from-go to-ice text-white glow-box animate-pulse-glow"
                  : "bg-surface-light text-text-dim cursor-not-allowed"
              )}
            >
              {players.length < 2
                ? `Need at least 2 players (${players.length}/2)`
                : `Start Game (${players.length} players)`}
            </button>
          ) : (
            <div className="text-center py-4 text-text-muted">
              Waiting for the host to start the game...
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
