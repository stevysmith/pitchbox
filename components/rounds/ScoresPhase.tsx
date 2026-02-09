"use client";

import { useMemo, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";
import { cn, getOrdinal } from "@/lib/utils";
import { motion } from "framer-motion";
import { AudioManager } from "@/lib/AudioManager";

interface ScoresPhaseProps {
  roomId: Doc<"rooms">["_id"];
  players: Doc<"players">[];
  currentPlayer: Doc<"players">;
  roundIndex: number;
  totalRounds: number;
  isHost: boolean;
  onNext: () => void;
}

export function ScoresPhase({
  roomId,
  players,
  currentPlayer,
  roundIndex,
  totalRounds,
  isHost,
  onNext,
}: ScoresPhaseProps) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const isLastRound = roundIndex === totalRounds - 1;

  // Query current round submissions to calculate rank changes
  const submissions = useQuery(api.submissions.getByRound, { roomId, round: roundIndex });

  // Calculate previous rankings (current score minus this round's score)
  const rankChanges = useMemo(() => {
    const changes: Record<string, number> = {};
    if (!submissions) return changes;

    // Build a map of this round's scores per player
    const roundScores: Record<string, number> = {};
    for (const sub of submissions) {
      try {
        const parsed = JSON.parse(sub.content);
        roundScores[sub.playerId] = parsed.score || sub.bonusPoints || 0;
      } catch {
        roundScores[sub.playerId] = sub.bonusPoints || 0;
      }
    }

    // Calculate previous scores and sort to get previous rankings
    const prevRanked = [...players]
      .map((p) => ({ id: p._id, prevScore: p.score - (roundScores[p._id] ?? 0) }))
      .sort((a, b) => b.prevScore - a.prevScore);

    const prevRankMap: Record<string, number> = {};
    prevRanked.forEach((p, i) => { prevRankMap[p.id] = i; });

    // Compare current rank to previous rank
    sorted.forEach((player, currentRank) => {
      const prevRank = prevRankMap[player._id];
      if (prevRank !== undefined) {
        changes[player._id] = prevRank - currentRank; // positive = moved up
      }
    });

    return changes;
  }, [players, submissions, sorted]);

  // Check if scores are close (within 50 points of leader)
  const leader = sorted[0];
  const closeRace = sorted.length >= 2 && leader && sorted[1] &&
    (leader.score - sorted[1].score) <= 50;

  // Suspense audio when close race
  const audioRef = useRef<AudioManager | null>(null);
  useEffect(() => {
    audioRef.current = new AudioManager();
    audioRef.current.resume();
    if (closeRace) {
      audioRef.current.suspense();
    }
    return () => audioRef.current?.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h3 className="text-xl font-display font-bold text-text">
          Leaderboard
        </h3>
        <p className="text-text-muted text-sm">
          After round {roundIndex + 1} of {totalRounds}
        </p>
      </div>

      {/* Close race indicator */}
      {closeRace && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <span className="inline-block bg-hot/15 text-hot px-3 py-1 rounded-full text-xs font-bold animate-pulse">
            CLOSE RACE! Only {leader!.score - sorted[1]!.score} pts apart
          </span>
        </motion.div>
      )}

      <div className="space-y-2">
        {sorted.map((player, i) => {
          const delta = rankChanges[player._id] ?? 0;
          return (
            <motion.div
              key={player._id}
              layout
              layoutId={`score-${player._id}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, layout: { type: "spring", stiffness: 300, damping: 30 } }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                i === 0
                  ? "bg-warn/10 border border-warn/30"
                  : "bg-surface-light",
                player._id === currentPlayer._id && "ring-1 ring-accent/40"
              )}
            >
              <span className="w-8 text-center font-mono font-bold text-lg">
                {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : getOrdinal(i + 1)}
              </span>
              <span className="text-xl">{player.emoji}</span>
              <span className="font-semibold text-text flex-1 truncate">
                {player.name}
                {player._id === currentPlayer._id && (
                  <span className="text-accent text-sm ml-1">(you)</span>
                )}
              </span>
              {/* Rank change arrow */}
              {delta !== 0 && roundIndex > 0 && (
                <span className={cn(
                  "text-xs font-bold",
                  delta > 0 ? "text-go" : "text-hot"
                )}>
                  {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                </span>
              )}
              <span className="font-mono font-bold text-accent text-lg">
                {player.score}
              </span>
            </motion.div>
          );
        })}
      </div>

      {isHost && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          onClick={onNext}
          className={cn(
            "w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98]",
            isLastRound
              ? "bg-gradient-to-r from-warn to-hot text-white"
              : "bg-accent text-white hover:bg-accent/90"
          )}
        >
          {isLastRound ? "Final Results 🏆" : "Next Round →"}
        </motion.button>
      )}

      {!isHost && (
        <p className="text-center text-text-dim text-sm">
          Waiting for host to continue...
        </p>
      )}
    </div>
  );
}
