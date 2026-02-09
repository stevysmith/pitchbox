"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { PLAYER_EMOJIS } from "@/lib/gameTypes";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";

interface JoinFormProps {
  roomId: Id<"rooms">;
  roomCode: string;
  sessionId: string;
  gameTitle?: string;
  gameEmoji?: string;
  playerCount: number;
  isLobby: boolean;
}

export function JoinForm({
  roomId,
  roomCode,
  sessionId,
  gameTitle,
  gameEmoji,
  playerCount,
  isLobby,
}: JoinFormProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(
    PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)]
  );
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  const joinRoom = useMutation(api.players.join);

  const handleJoin = async () => {
    if (!name.trim()) return;
    setIsJoining(true);
    setError("");

    try {
      await joinRoom({
        roomId,
        name: name.trim(),
        emoji,
        sessionId,
      });
    } catch (e: any) {
      setError(e.message || "Couldn't join. Try again.");
      setIsJoining(false);
    }
  };

  if (!isLobby) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 space-y-6">
        <div className="text-6xl">⏳</div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-display font-bold">Game in progress</h1>
          <p className="text-text-muted">
            This game has already started. You'll be able to join the next round!
          </p>
        </div>
        <Link
          href="/"
          className="px-5 py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-colors"
        >
          Create your own game
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        {/* Game Info */}
        <div className="text-center space-y-2">
          {gameEmoji && <div className="text-5xl">{gameEmoji}</div>}
          <h1 className="text-2xl font-display font-bold">
            {gameTitle || "Join Game"}
          </h1>
          <p className="text-text-muted">
            Room{" "}
            <span className="font-mono font-bold text-accent">{roomCode}</span>
            {" · "}
            {playerCount} player{playerCount !== 1 ? "s" : ""} waiting
          </p>
        </div>

        {/* Join Form */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-muted">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full bg-surface-light rounded-xl px-4 py-3 text-text text-lg placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-muted">
              Pick your avatar
            </label>
            <div className="flex flex-wrap gap-2">
              {PLAYER_EMOJIS.slice(0, 16).map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all",
                    emoji === e
                      ? "bg-accent/20 ring-2 ring-accent scale-110"
                      : "bg-surface-light hover:bg-surface-hover"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={!name.trim() || isJoining}
          className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-all active:scale-[0.98]"
        >
          {isJoining ? "Joining..." : "Join Game"}
        </button>

        {error && (
          <p className="text-hot text-sm text-center">{error}</p>
        )}
      </motion.div>
    </div>
  );
}
