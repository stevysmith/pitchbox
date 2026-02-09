"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";

const REACTION_EMOJIS = ["🔥", "😂", "💀", "👏", "😮", "🤯"];

interface ReactionBarProps {
  roomId: Id<"rooms">;
  playerId: Id<"players">;
}

export function ReactionBar({ roomId, playerId }: ReactionBarProps) {
  const sendReaction = useMutation(api.reactions.send);
  const reactions = useQuery(api.reactions.getRecent, { roomId });
  const [floatingReactions, setFloatingReactions] = useState<
    { id: string; emoji: string; x: number; playerEmoji: string }[]
  >([]);

  // Track new reactions and create floating animations
  useEffect(() => {
    if (!reactions) return;
    const now = Date.now();
    const newOnes = reactions.filter(
      (r) => now - r.createdAt < 3000
    );
    setFloatingReactions(
      newOnes.map((r) => ({
        id: r._id,
        emoji: r.emoji,
        x: 20 + Math.random() * 60, // random horizontal position (%)
        playerEmoji: r.playerEmoji,
      }))
    );
  }, [reactions]);

  return (
    <>
      {/* Floating reactions */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 1, y: "80vh", x: `${r.x}vw` }}
              animate={{ opacity: 0, y: "20vh" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="absolute text-3xl"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Reaction bar */}
      <div className="flex items-center justify-center gap-2 py-2">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              sendReaction({ roomId, playerId, emoji }).catch(() => {});
            }}
            className="text-2xl hover:scale-125 active:scale-90 transition-transform p-1"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
