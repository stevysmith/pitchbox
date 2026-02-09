"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { GameRound } from "@/lib/gameTypes";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AudioManager } from "@/lib/AudioManager";

interface RevealPhaseProps {
  room: Doc<"rooms">;
  currentPlayer: Doc<"players">;
  players: Doc<"players">[];
  roundIndex: number;
  round: GameRound;
  isHost: boolean;
  onNext: () => void;
}

export function RevealPhase({
  room,
  currentPlayer,
  players,
  roundIndex,
  round,
  isHost,
  onNext,
}: RevealPhaseProps) {
  const submissions = useQuery(api.submissions.getByRound, {
    roomId: room._id,
    round: roundIndex,
  });

  const [phase, setPhase] = useState<"drumroll" | "revealing" | "done">("drumroll");
  const [revealedCount, setRevealedCount] = useState(0);
  const audioRef = useRef<AudioManager | null>(null);
  const drumrollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lazy audio init
  useEffect(() => {
    audioRef.current = new AudioManager();
    audioRef.current.resume();
    return () => { audioRef.current?.destroy(); };
  }, []);

  // Parse and sort scores
  const playerScores = useMemo(() => {
    return (submissions ?? [])
      .map((sub) => {
        let score = 0;
        try {
          const parsed = JSON.parse(sub.content);
          score = parsed.score || 0;
        } catch {
          score = 0;
        }
        return { ...sub, gameScore: score };
      })
      .sort((a, b) => b.gameScore - a.gameScore);
  }, [submissions]);

  // Find previous round leader for "NEW LEADER" detection
  const previousLeader = useMemo(() => {
    const sorted = [...players].sort((a, b) => {
      // Subtract this round's scores to get pre-round standings
      const aRoundScore = playerScores.find(ps => ps.playerId === a._id)?.gameScore ?? 0;
      const bRoundScore = playerScores.find(ps => ps.playerId === b._id)?.gameScore ?? 0;
      return (b.score - bRoundScore) - (a.score - aRoundScore);
    });
    return sorted[0]?._id;
  }, [players, playerScores]);

  const currentLeader = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return sorted[0]?._id;
  }, [players]);

  const isNewLeader = previousLeader && currentLeader && previousLeader !== currentLeader;

  // Drumroll phase (2 seconds)
  useEffect(() => {
    if (phase === "drumroll") {
      drumrollRef.current = audioRef.current?.drumroll() ?? null;
      const timer = setTimeout(() => {
        if (drumrollRef.current) clearInterval(drumrollRef.current);
        setPhase("revealing");
      }, 2000);
      return () => { clearTimeout(timer); if (drumrollRef.current) clearInterval(drumrollRef.current); };
    }
  }, [phase]);

  // Reveal scores last-to-first with delays
  useEffect(() => {
    if (phase !== "revealing" || playerScores.length === 0) return;

    const total = playerScores.length;
    // Reveal from last to first (build tension)
    const timer = setTimeout(() => {
      if (revealedCount < total) {
        setRevealedCount((c) => c + 1);
        audioRef.current?.scoreTick();
      }
      if (revealedCount + 1 >= total) {
        // All revealed — pause then done
        setTimeout(() => {
          setPhase("done");
          if (playerScores[0]?.gameScore > 0) {
            audioRef.current?.fanfare();
          }
          if (isNewLeader) {
            setTimeout(() => audioRef.current?.newLeader(), 600);
          }
        }, 1000);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [phase, revealedCount, playerScores, isNewLeader]);

  // Reversed order for reveal (last place first, winner last)
  const revealOrder = useMemo(() => [...playerScores].reverse(), [playerScores]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-sm font-medium text-text-dim uppercase tracking-wider">
          Round Results
        </h3>
        <p className="text-xs text-text-muted">
          {getSceneResultLabel(round?.config?.sceneType as string)}
        </p>
      </div>

      {/* Drumroll overlay */}
      <AnimatePresence>
        {phase === "drumroll" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="text-5xl font-display font-black text-text"
            >
              Who won?
            </motion.div>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-text-muted mt-2 text-sm"
            >
              drumroll...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score reveals */}
      {phase !== "drumroll" && (
        <div className="space-y-3">
          {revealOrder.map((sub, i) => {
            const isRevealed = i < revealedCount;
            const actualRank = playerScores.findIndex((ps) => ps._id === sub._id);
            const isWinner = actualRank === 0 && phase === "done";

            return (
              <AnimatePresence key={sub._id}>
                {isRevealed && (
                  <motion.div
                    initial={{ opacity: 0, x: -30, scale: 0.9 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: isWinner ? 1.05 : 1,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                    }}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl transition-all",
                      isWinner
                        ? "bg-warn/15 border-2 border-warn/40 shadow-lg shadow-warn/10"
                        : actualRank === 1
                          ? "bg-surface-light border border-white/10"
                          : "bg-surface-light"
                    )}
                  >
                    <span className="text-2xl w-8 text-center">
                      {actualRank === 0
                        ? "👑"
                        : actualRank === 1
                          ? "🥈"
                          : actualRank === 2
                            ? "🥉"
                            : `${actualRank + 1}.`}
                    </span>
                    <span className="text-lg">{sub.playerEmoji}</span>
                    <span className="font-semibold text-text text-sm flex-1">
                      {sub.playerName}
                    </span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-lg text-accent">
                        {sub.gameScore}
                      </span>
                      <span className="text-xs text-text-dim ml-1">pts</span>
                      <div className="text-xs text-go font-medium">
                        +{sub.gameScore} this round
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            );
          })}
        </div>
      )}

      {/* NEW LEADER callout */}
      <AnimatePresence>
        {phase === "done" && isNewLeader && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="text-center py-2"
          >
            <span className="inline-block bg-gradient-to-r from-warn to-hot text-white px-4 py-1.5 rounded-full font-bold text-sm animate-pulse">
              NEW LEADER!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {playerScores.length === 0 && phase !== "drumroll" && (
        <div className="text-center text-text-muted py-8">
          <p>No scores recorded this round</p>
        </div>
      )}

      {isHost && phase === "done" && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onNext}
          className="w-full py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all active:scale-[0.98]"
        >
          Next →
        </motion.button>
      )}
    </div>
  );
}

function getSceneResultLabel(sceneType: string): string {
  const map: Record<string, string> = {
    runner: "How far did everyone get?",
    arena: "Who collected the most?",
    platformer: "Who conquered the level?",
    dodge: "Who survived the longest?",
    shooter: "Who had the best aim?",
    puzzle: "Who matched the most?",
    catcher: "Who caught the most?",
    climber: "Who climbed the highest?",
    memory: "Who remembered the most?",
    sumo: "Who stayed standing?",
  };
  return map[sceneType] ?? "Final scores are in!";
}
