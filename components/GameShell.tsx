"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { GameDefinition, GameRound } from "@/lib/gameTypes";
import { SceneConfig, SceneType } from "@/lib/phaserTypes";
import { cn, formatTimeLeft } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { PhaserGame } from "./PhaserGame";
import { IframeGame } from "./IframeGame";
import { RevealPhase } from "./rounds/RevealPhase";
import { ScoresPhase } from "./rounds/ScoresPhase";
import { ReactionBar } from "./ReactionBar";
import { AudioManager } from "@/lib/AudioManager";

interface GameShellProps {
  room: Doc<"rooms">;
  gameDefinition: GameDefinition;
  players: Doc<"players">[];
  currentPlayer: Doc<"players">;
  sessionId: string;
}

export function GameShell({
  room,
  gameDefinition,
  players,
  currentPlayer,
  sessionId,
}: GameShellProps) {
  const advancePhase = useMutation(api.rooms.advancePhase);
  const submitScore = useMutation(api.submissions.submit);
  const playerHeartbeat = useMutation(api.rooms.playerHeartbeat);
  const transferHost = useMutation(api.rooms.transferHost);
  const isHost = currentPlayer.isHost;
  const currentRound = gameDefinition.rounds[room.currentRound];
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const shellAudioRef = useRef<AudioManager | null>(null);

  // Init audio manager
  useEffect(() => {
    shellAudioRef.current = new AudioManager();
    shellAudioRef.current.resume();
    return () => shellAudioRef.current?.destroy();
  }, []);

  // Countdown beeps during intro phase (3-2-1-GO over 4s)
  useEffect(() => {
    if (room.roundPhase !== "intro") return;
    const audio = shellAudioRef.current;
    if (!audio) return;

    // Beep at 1s, 2s, 3s, then GO at 3.5s
    const t1 = setTimeout(() => audio.countdownBeep(3), 1000);
    const t2 = setTimeout(() => audio.countdownBeep(2), 2000);
    const t3 = setTimeout(() => audio.countdownBeep(1), 3000);
    const tGo = setTimeout(() => audio.countdownBeep(0), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(tGo); };
  }, [room.roundPhase, room.currentRound]);

  // Player heartbeat system (ping every 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      playerHeartbeat({ roomId: room._id, sessionId }).catch(() => {});
    }, 10000);
    // Initial heartbeat
    playerHeartbeat({ roomId: room._id, sessionId }).catch(() => {});
    return () => clearInterval(interval);
  }, [room._id, sessionId, playerHeartbeat]);

  // Detect host disconnect (30s without heartbeat)
  useEffect(() => {
    if (isHost) return;
    const host = players.find((p) => p.isHost);
    if (!host) { setHostDisconnected(true); return; }
    const lastBeat = host.lastHeartbeat || host.joinedAt;
    setHostDisconnected(Date.now() - lastBeat > 30000);

    const interval = setInterval(() => {
      const hb = host.lastHeartbeat || host.joinedAt;
      setHostDisconnected(Date.now() - hb > 30000);
    }, 5000);
    return () => clearInterval(interval);
  }, [isHost, players]);

  // Reset submitted state when round/phase changes
  useEffect(() => {
    setHasSubmitted(false);
  }, [room.currentRound, room.roundPhase]);

  // Timer
  useEffect(() => {
    if (!room.roundStartedAt || room.roundPhase === "intro" || room.roundPhase === "scores") {
      setTimeLeft(0);
      return;
    }

    const duration =
      room.roundPhase === "submit"
        ? currentRound?.timeLimit ?? 30
        : room.roundPhase === "vote"
          ? 20
          : 5; // reveal

    const updateTimer = () => {
      const elapsed = (Date.now() - room.roundStartedAt!) / 1000;
      const remaining = Math.max(0, Math.ceil(duration - elapsed));
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 250);
    return () => clearInterval(interval);
  }, [room.roundStartedAt, room.roundPhase, currentRound?.timeLimit]);

  // Auto-advance for host when timer expires
  useEffect(() => {
    if (!isHost || timeLeft > 0 || room.roundPhase === "intro") return;

    const timeout = setTimeout(() => {
      advancePhase({ roomId: room._id, sessionId }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timeout);
  }, [timeLeft, isHost, room.roundPhase, room._id, sessionId, advancePhase]);

  // Auto-advance intro phase
  useEffect(() => {
    if (!isHost || room.roundPhase !== "intro") return;
    const timeout = setTimeout(() => {
      advancePhase({ roomId: room._id, sessionId }).catch(() => {});
    }, 4000); // 4s for better readability
    return () => clearTimeout(timeout);
  }, [isHost, room.roundPhase, room._id, room.currentRound, sessionId, advancePhase]);

  const handleAdvance = useCallback(() => {
    if (!isHost) return;
    advancePhase({ roomId: room._id, sessionId }).catch(() => {});
  }, [isHost, room._id, sessionId, advancePhase]);

  const handleScoreSubmit = useCallback(
    async (score: number) => {
      if (hasSubmitted) return;
      setHasSubmitted(true);
      try {
        const roundType = currentRound?.type === "html-game" ? "html-game" : "phaser-game";
        await submitScore({
          roomId: room._id,
          playerId: currentPlayer._id,
          round: room.currentRound,
          content: JSON.stringify({ score, type: roundType }),
          type: "text",
        });
      } catch (e) {
        // Submission may fail if already submitted
      }
    },
    [hasSubmitted, submitScore, room._id, currentPlayer._id, room.currentRound]
  );

  const theme = gameDefinition.theme;
  const sceneType = currentRound?.config?.sceneType as SceneType | undefined;

  return (
    <div className="min-h-dvh flex flex-col" style={{
      background: `linear-gradient(135deg, ${theme.primaryColor}22 0%, ${theme.secondaryColor}11 100%)`,
    }}>
      {/* Game Header */}
      <header className="flex items-center justify-between p-3 md:p-4 glass border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-xl">{theme.emoji}</span>
          <div>
            <div className="font-display font-bold text-sm text-text">
              {gameDefinition.title}
            </div>
            <div className="text-xs text-text-dim">
              Round {room.currentRound + 1}/{gameDefinition.rounds.length}
            </div>
          </div>
        </div>

        {/* Timer */}
        {timeLeft > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full font-mono font-bold text-lg",
              timeLeft <= 5 ? "bg-hot/20 text-hot" : "bg-surface-light text-text"
            )}
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                timeLeft <= 5 ? "bg-hot animate-ping" : "bg-go"
              )}
            />
            {formatTimeLeft(timeLeft)}
          </motion.div>
        )}

        {/* Score */}
        <div className="text-right">
          <div className="text-lg font-bold text-accent">
            {currentPlayer.score}
          </div>
          <div className="text-xs text-text-dim">pts</div>
        </div>
      </header>

      {/* Mini Scoreboard */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto">
        {[...players]
          .sort((a, b) => b.score - a.score)
          .map((player) => (
            <div
              key={player._id}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                player._id === currentPlayer._id
                  ? "bg-accent/20 text-accent-light"
                  : "bg-surface/50 text-text-muted"
              )}
            >
              <span>{player.emoji}</span>
              <span className="font-medium max-w-[60px] truncate">
                {player.name}
              </span>
              <span className="font-mono font-bold">{player.score}</span>
            </div>
          ))}
      </div>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-6 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* Intro Phase */}
          {room.roundPhase === "intro" && (
            <motion.div
              key={`intro-${room.currentRound}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="text-center space-y-4"
            >
              {/* Round progress bar */}
              <div className="flex gap-1.5 justify-center mb-2">
                {gameDefinition.rounds.map((_: any, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i < room.currentRound ? "bg-accent w-6" :
                      i === room.currentRound ? "bg-accent w-10" :
                      "bg-surface-light w-6"
                    )}
                  />
                ))}
              </div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
                className="text-7xl"
              >
                {getSceneEmoji(sceneType)}
              </motion.div>
              <div>
                <div className="text-sm font-medium text-accent uppercase tracking-wider mb-1">
                  Round {room.currentRound + 1}
                </div>
                <h2 className="text-3xl font-display font-bold text-text">
                  {currentRound?.title}
                </h2>
              </div>
              <p className="text-text-muted text-lg">
                {currentRound?.description}
              </p>

              {/* Difficulty indicator */}
              {(() => {
                const diff = currentRound?.config?.difficulty ?? (room.currentRound + 1);
                return (
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <span
                        key={level}
                        className={cn(
                          "text-sm transition-all",
                          level <= diff ? "opacity-100" : "opacity-20"
                        )}
                      >
                        {level <= diff ? "🔥" : "⚪"}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* Tip text */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-accent/70 font-medium"
              >
                {getIntroTip(room.currentRound, gameDefinition.rounds.length)}
              </motion.div>

              {currentRound?.type === "html-game" ? (
                <div className="text-xs text-text-dim font-mono uppercase tracking-widest">
                  Micro-Game
                </div>
              ) : sceneType ? (
                <div className="text-xs text-text-dim font-mono uppercase tracking-widest">
                  {getSceneLabel(sceneType)}
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Submit Phase — HTML Game or Phaser Game */}
          {room.roundPhase === "submit" && currentRound && (
            <motion.div
              key={`submit-${room.currentRound}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full relative"
            >
              {currentPlayer.isSpectator ? (
                <div className="w-full aspect-video flex items-center justify-center bg-surface-light rounded-xl">
                  <div className="text-center space-y-2">
                    <div className="text-4xl">👀</div>
                    <p className="text-text-muted font-medium">Watching...</p>
                    <p className="text-text-dim text-sm">You joined as a spectator</p>
                  </div>
                </div>
              ) : currentRound.type === "html-game" && currentRound.gameCode ? (
                <IframeGame
                  gameCode={currentRound.gameCode}
                  room={room}
                  currentPlayer={currentPlayer}
                  players={players}
                  roundIndex={room.currentRound}
                  gameDefinition={gameDefinition}
                  onScoreSubmit={handleScoreSubmit}
                />
              ) : (
                <PhaserGame
                  config={{ ...(currentRound.config as unknown as SceneConfig), spriteImages: gameDefinition.spriteImages, artStyle: gameDefinition.artStyle || "modern" }}
                  room={room}
                  currentPlayer={currentPlayer}
                  players={players}
                  roundIndex={room.currentRound}
                  onScoreSubmit={handleScoreSubmit}
                />
              )}
            </motion.div>
          )}

          {/* Reveal Phase */}
          {room.roundPhase === "reveal" && (
            <motion.div
              key={`reveal-${room.currentRound}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <RevealPhase
                room={room}
                currentPlayer={currentPlayer}
                players={players}
                roundIndex={room.currentRound}
                round={currentRound}
                isHost={isHost}
                onNext={handleAdvance}
              />
            </motion.div>
          )}

          {/* Scores Phase */}
          {room.roundPhase === "scores" && (
            <motion.div
              key={`scores-${room.currentRound}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <ScoresPhase
                roomId={room._id}
                players={players}
                currentPlayer={currentPlayer}
                roundIndex={room.currentRound}
                totalRounds={gameDefinition.rounds.length}
                isHost={isHost}
                onNext={handleAdvance}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reactions during reveal/scores */}
        {(room.roundPhase === "reveal" || room.roundPhase === "scores") && (
          <ReactionBar roomId={room._id} playerId={currentPlayer._id} />
        )}

        {/* Become Host button when host disconnected */}
        {hostDisconnected && !isHost && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center"
          >
            <p className="text-text-muted text-sm mb-2">
              Host appears disconnected
            </p>
            <button
              onClick={() => {
                transferHost({ roomId: room._id, sessionId })
                  .then(() => setHostDisconnected(false))
                  .catch(() => {});
              }}
              className="px-4 py-2 bg-warn/20 text-warn border border-warn/30 rounded-xl font-semibold text-sm hover:bg-warn/30 transition-all"
            >
              Become Host
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}

function getIntroTip(roundIndex: number, totalRounds: number): string {
  const tips = [
    "Tap fast! Build combos for bonus points",
    "Watch your combos — streaks mean multipliers!",
    "Risk-reward: harder targets = more points",
    "Getting wild now... stay focused!",
    "Final push! Every point counts",
  ];
  if (roundIndex < tips.length) return tips[roundIndex];
  if (roundIndex === totalRounds - 1) return "Last round — give it everything!";
  return "Keep the combos going!";
}

function getSceneEmoji(sceneType?: string): string {
  const map: Record<string, string> = {
    runner: "🏃",
    arena: "⚔️",
    platformer: "🕹️",
    dodge: "☄️",
    shooter: "🎯",
    puzzle: "🧩",
    catcher: "🧺",
    climber: "⬆️",
    memory: "🧠",
    sumo: "💪",
  };
  return map[sceneType ?? ""] ?? "🎮";
}

function getSceneLabel(sceneType: string): string {
  const map: Record<string, string> = {
    runner: "Side-Scroller",
    arena: "Arena Battle",
    platformer: "Platformer",
    dodge: "Dodge Game",
    shooter: "Target Shooter",
    puzzle: "Puzzle Challenge",
    catcher: "Catch Game",
    climber: "Vertical Climb",
    memory: "Memory Game",
    sumo: "Sumo Arena",
  };
  return map[sceneType] ?? "Micro-Game";
}
