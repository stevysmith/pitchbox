"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { GameDefinition } from "@/lib/gameTypes";
import { cn, getOrdinal } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { AudioManager } from "@/lib/AudioManager";

interface GameResultsProps {
  room: Doc<"rooms">;
  game: Doc<"games">;
  gameDefinition: GameDefinition;
  players: Doc<"players">[];
  currentPlayer: Doc<"players">;
}

export function GameResults({
  room,
  game,
  gameDefinition,
  players,
  currentPlayer,
}: GameResultsProps) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const winner = sorted[0];
  const myRank = sorted.findIndex((p) => p._id === currentPlayer._id) + 1;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const router = useRouter();
  const [rematchLoading, setRematchLoading] = useState(false);
  const generateGame = useAction(api.gameFlow.generateAndCreateGame);
  const setRematchCode = useMutation(api.rooms.setRematchCode);

  // Query all submissions to determine per-round winners
  const allSubmissions = useQuery(api.submissions.getAllByRoom, { roomId: room._id });

  const roundWinners = useMemo(() => {
    if (!allSubmissions) return [];
    const results: { roundIndex: number; title: string; winnerName: string; winnerEmoji: string; score: number }[] = [];

    for (let r = 0; r < gameDefinition.rounds.length; r++) {
      const roundSubs = allSubmissions.filter((s) => s.round === r);
      if (roundSubs.length === 0) continue;

      // Find top scorer this round
      let best = roundSubs[0];
      for (const sub of roundSubs) {
        let subScore = 0;
        let bestScore = 0;
        try { subScore = JSON.parse(sub.content).score || sub.bonusPoints || 0; } catch { subScore = sub.bonusPoints || 0; }
        try { bestScore = JSON.parse(best.content).score || best.bonusPoints || 0; } catch { bestScore = best.bonusPoints || 0; }
        if (subScore > bestScore) best = sub;
      }

      let bestScore = 0;
      try { bestScore = JSON.parse(best.content).score || best.bonusPoints || 0; } catch { bestScore = best.bonusPoints || 0; }

      if (bestScore > 0) {
        results.push({
          roundIndex: r,
          title: gameDefinition.rounds[r]?.title || `Round ${r + 1}`,
          winnerName: best.playerName,
          winnerEmoji: best.playerEmoji,
          score: bestScore,
        });
      }
    }
    return results;
  }, [allSubmissions, gameDefinition.rounds]);

  // Auto-redirect when rematch room is created
  useEffect(() => {
    if (room.rematchCode) {
      router.push(`/play/${room.rematchCode}`);
    }
  }, [room.rematchCode, router]);

  const handleRematch = useCallback(async () => {
    if (rematchLoading) return;
    setRematchLoading(true);
    try {
      const result = await generateGame({
        prompt: game.prompt,
        hostName: currentPlayer.name,
        hostEmoji: currentPlayer.emoji,
        sessionId: currentPlayer.sessionId,
      });
      // Set rematch code on old room so all players auto-redirect
      await setRematchCode({ roomId: room._id, rematchCode: result.code });
      router.push(`/play/${result.code}`);
    } catch (e) {
      console.error("Rematch failed:", e);
      setRematchLoading(false);
    }
  }, [rematchLoading, generateGame, game.prompt, currentPlayer, setRematchCode, room._id, router]);

  // Fanfare on mount
  useEffect(() => {
    audioRef.current = new AudioManager();
    audioRef.current.resume();
    setTimeout(() => audioRef.current?.fanfare(), 500);
    return () => audioRef.current?.destroy();
  }, []);

  // Confetti animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#fbbf24", "#ef4444", "#4ade80", "#818cf8", "#f472b6", "#22d3ee"];
    const confetti: { x: number; y: number; vx: number; vy: number; r: number; color: string; rot: number; rv: number }[] = [];

    for (let i = 0; i < 100; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 3,
        r: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        rv: (Math.random() - 0.5) * 0.2,
      });
    }

    let frame: number;
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const c of confetti) {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.03;
        c.rot += c.rv;
        if (c.y > canvas.height + 20) {
          c.y = -20;
          c.x = Math.random() * canvas.width;
          c.vy = 2 + Math.random() * 3;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.r, -c.r / 2, c.r * 2, c.r);
        ctx.restore();
      }
      frame = requestAnimationFrame(animate);
    }
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Generate fun superlatives
  const superlatives = useMemo(() => {
    if (sorted.length < 2) return [];
    const results: { label: string; player: Doc<"players"> }[] = [];

    // Most Consistent: player closest to average across rounds (approximate: lowest score = tried but moderate)
    if (sorted.length >= 3) {
      const mid = sorted[Math.floor(sorted.length / 2)];
      results.push({ label: "Most Consistent", player: mid });
    }

    // Closest to leader (not the winner)
    if (sorted.length >= 2 && sorted[1]) {
      const diff = sorted[0].score - sorted[1].score;
      if (diff <= 50) {
        results.push({ label: "Almost Had It", player: sorted[1] });
      }
    }

    // Last place gets a fun award
    const last = sorted[sorted.length - 1];
    if (last && last._id !== winner?._id) {
      results.push({ label: "Vibes Over Victory", player: last });
    }

    return results.slice(0, 3);
  }, [sorted, winner]);

  const celebrations = [
    "absolutely demolished it",
    "built different fr",
    "main character energy",
    "understood the assignment",
    "no notes, just vibes",
  ];

  const handleShare = useCallback(() => {
    const text = `Just played "${gameDefinition.title}" on pitch.box! ${winner?.name} won with ${winner?.score} points 🏆`;
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
    }
  }, [gameDefinition.title, winner]);

  return (
    <div className="min-h-dvh flex flex-col relative">
      {/* Confetti canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-50"
        style={{ width: "100vw", height: "100vh" }}
      />

      <header className="flex items-center justify-between p-4 md:p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          <span className="font-display font-bold text-xl text-text">
            pitch.box
          </span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8 max-w-lg mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full space-y-8"
        >
          {/* Winner Celebration */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="text-8xl mx-auto w-fit"
            >
              🏆
            </motion.div>

            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-5xl mb-2">{winner?.emoji}</div>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-text">
                  {winner?.name} wins!
                </h1>
                <p className="text-text-muted text-lg mt-1">
                  {celebrations[Math.floor(Math.random() * celebrations.length)]}
                </p>
              </motion.div>
            </div>
          </div>

          {/* Your Result */}
          {myRank > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center glass rounded-xl p-4"
            >
              <p className="text-text-muted">
                You placed{" "}
                <span className="font-bold text-accent">
                  {getOrdinal(myRank)}
                </span>{" "}
                with{" "}
                <span className="font-bold text-text">
                  {currentPlayer.score} points
                </span>
              </p>
            </motion.div>
          )}

          {/* Fun Superlatives */}
          {superlatives.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="flex flex-wrap justify-center gap-2"
            >
              {superlatives.map((s, i) => (
                <div
                  key={i}
                  className="bg-surface-light rounded-lg px-3 py-2 text-center"
                >
                  <div className="text-xs text-text-dim uppercase tracking-wider">
                    {s.label}
                  </div>
                  <div className="text-sm font-semibold text-text">
                    {s.player.emoji} {s.player.name}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Per-Round Winners */}
          {roundWinners.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="space-y-2"
            >
              <h3 className="text-sm font-medium text-text-dim uppercase tracking-wider text-center">
                Round Winners
              </h3>
              <div className="grid gap-1.5">
                {roundWinners.map((rw) => (
                  <div
                    key={rw.roundIndex}
                    className="flex items-center gap-2 bg-surface-light/60 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-text-dim font-mono text-xs w-5">
                      R{rw.roundIndex + 1}
                    </span>
                    <span className="text-text-muted truncate flex-1 text-xs">
                      {rw.title}
                    </span>
                    <span>{rw.winnerEmoji}</span>
                    <span className="font-semibold text-text text-xs truncate max-w-[80px]">
                      {rw.winnerName}
                    </span>
                    <span className="font-mono text-accent text-xs font-bold">
                      {rw.score}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Final Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="space-y-2"
          >
            <h3 className="text-sm font-medium text-text-dim uppercase tracking-wider text-center">
              Final Standings
            </h3>
            {sorted.map((player, i) => (
              <motion.div
                key={player._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + i * 0.1 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl",
                  i === 0
                    ? "bg-gradient-to-r from-warn/20 to-warn/5 border border-warn/30"
                    : "bg-surface-light",
                  player._id === currentPlayer._id && "ring-1 ring-accent/40"
                )}
              >
                <span className="w-8 text-center font-bold text-lg">
                  {i === 0
                    ? "👑"
                    : i === 1
                      ? "🥈"
                      : i === 2
                        ? "🥉"
                        : getOrdinal(i + 1)}
                </span>
                <span className="text-2xl">{player.emoji}</span>
                <span className="font-semibold text-text flex-1 truncate">
                  {player.name}
                </span>
                <span className="font-mono font-bold text-accent text-lg">
                  {player.score}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="flex flex-col gap-3"
          >
            <button
              onClick={handleRematch}
              disabled={rematchLoading}
              className={cn(
                "w-full py-3.5 bg-gradient-to-r from-accent to-ice text-white rounded-xl font-bold text-lg text-center transition-all active:scale-[0.98]",
                rematchLoading ? "opacity-60 cursor-wait" : "hover:opacity-90"
              )}
            >
              {rematchLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="inline-block"
                  >
                    🎲
                  </motion.span>
                  Generating rematch...
                </span>
              ) : (
                "Rematch — Same Prompt 🔄"
              )}
            </button>
            <Link
              href="/"
              className="w-full py-3 bg-surface-light text-text rounded-xl font-semibold text-center hover:bg-surface-hover transition-all"
            >
              New Game, New Prompt ✨
            </Link>
            <button
              onClick={handleShare}
              className="w-full py-3 bg-surface-light/50 text-text-muted rounded-xl font-semibold hover:bg-surface-hover transition-all"
            >
              Share Results
            </button>
          </motion.div>

          {/* Game Info */}
          <div className="text-center text-text-dim text-xs space-y-1">
            <p>
              {gameDefinition.theme.emoji} {gameDefinition.title} ·{" "}
              {gameDefinition.rounds.length} rounds · {players.length} players
            </p>
            <p>Prompt: &ldquo;{game.prompt}&rdquo;</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
