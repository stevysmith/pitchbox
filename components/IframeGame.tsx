"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Doc } from "../convex/_generated/dataModel";
import { GameDefinition } from "@/lib/gameTypes";
import { IFRAME_SDK_CODE } from "@/lib/iframeSDK";
import { GameInitPayload, HeartbeatPayload, IframeOutboundMessage } from "@/lib/iframeTypes";
import { motion, AnimatePresence } from "framer-motion";

interface IframeGameProps {
  gameCode: string;
  room: Doc<"rooms">;
  currentPlayer: Doc<"players">;
  players: Doc<"players">[];
  roundIndex: number;
  gameDefinition: GameDefinition;
  onScoreSubmit: (score: number) => void;
}

type GameState = "loading" | "countdown" | "playing" | "complete" | "error";

export function IframeGame({
  gameCode,
  room,
  currentPlayer,
  players,
  roundIndex,
  gameDefinition,
  onScoreSubmit,
}: IframeGameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [gameState, setGameState] = useState<GameState>("loading");
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const submittedRef = useRef(false);
  const lastScoreRef = useRef(0);
  const readyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const crashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef(Date.now());
  const errorCountRef = useRef(0);
  const lastHeartbeatRef = useRef<{
    payload: HeartbeatPayload | null;
    time: number;
    prevFc: number;
    stalledCount: number;
    blankCount: number;
  }>({ payload: null, time: Date.now(), prevFc: -1, stalledCount: 0, blankCount: 0 });

  const onScoreSubmitRef = useRef(onScoreSubmit);
  useEffect(() => { onScoreSubmitRef.current = onScoreSubmit; }, [onScoreSubmit]);
  const hasPlayedRef = useRef(false);

  const currentRound = gameDefinition.rounds[roundIndex];
  const theme = gameDefinition.theme;

  // Submit last known score on unmount — guarded by hasPlayedRef to avoid
  // React strict mode's fake cleanup (which fires before gameplay starts)
  useEffect(() => {
    return () => {
      if (hasPlayedRef.current && !submittedRef.current) {
        submittedRef.current = true;
        const safe = Math.max(0, Math.floor(lastScoreRef.current) || 0);
        onScoreSubmitRef.current(safe);
      }
    };
  }, []);

  // Build srcdoc
  const srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e;font-family:system-ui,sans-serif;}
canvas{display:block;touch-action:none;}
</style>
${IFRAME_SDK_CODE}
</head>
<body>
${gameCode}
</body>
</html>`;

  // Submit score helper
  const submitScore = useCallback(
    (finalScore: number) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const safe = Math.max(0, Math.floor(finalScore) || 0);
      onScoreSubmit(safe);
    },
    [onScoreSubmit]
  );

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as IframeOutboundMessage;
      if (!data || !data.type) return;

      lastMessageTimeRef.current = Date.now();

      switch (data.type) {
        case "GAME_READY":
          if (gameState === "loading") {
            if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
            setGameState("countdown");
            sendInit();
          }
          break;

        case "HEARTBEAT":
          // Parse health payload for the health state machine
          if (data.payload) {
            const hb = lastHeartbeatRef.current;
            hb.payload = data.payload as HeartbeatPayload;
            hb.time = Date.now();
          }
          break;

        case "SCORE_UPDATE":
          if (data.payload && typeof data.payload.score === "number") {
            const s = Math.max(0, Math.floor(data.payload.score) || 0);
            setScore(s);
            lastScoreRef.current = s;
          }
          break;

        case "GAME_COMPLETE":
          if (data.payload && typeof data.payload.score === "number") {
            const s = Math.max(0, Math.floor(data.payload.score) || 0);
            setScore(s);
            setGameState("complete");
            submitScore(s);
          }
          break;

        case "GAME_ERROR": {
          const errorPayload = data.payload as { message?: string; fatal?: boolean } | undefined;
          console.warn("[IframeGame] Error from game:", errorPayload?.message);
          errorCountRef.current++;
          if (errorPayload?.fatal || errorCountRef.current >= 5) {
            setGameState("error");
            setErrorMsg(errorPayload?.message || "Game crashed");
            submitScore(lastScoreRef.current);
          }
          break;
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [gameState, submitScore]);

  // Send GAME_INIT to iframe
  const sendInit = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const playerIndex = players.findIndex((p) => p._id === currentPlayer._id);
    const payload: GameInitPayload = {
      player: {
        id: currentPlayer._id,
        name: currentPlayer.name,
        emoji: currentPlayer.emoji,
        color: theme.accentColor,
        index: playerIndex >= 0 ? playerIndex : 0,
      },
      config: {
        timeLimit: currentRound?.timeLimit ?? 30,
        difficulty: currentRound?.config?.difficulty ?? 1,
        theme: currentRound?.config?.theme ?? "",
      },
      sprites: {
        player: gameDefinition.spriteImages?.player,
        collectible: gameDefinition.spriteImages?.collectible,
        hazard: gameDefinition.spriteImages?.hazard,
        background: gameDefinition.spriteImages?.background,
      },
      theme: {
        emoji: theme.emoji,
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        accentColor: theme.accentColor,
      },
    };

    iframe.contentWindow.postMessage({ type: "GAME_INIT", payload }, "*");
  }, [currentPlayer, players, currentRound, gameDefinition, theme]);

  // Timeout: no GAME_READY in 5s
  useEffect(() => {
    if (gameState !== "loading") return;

    readyTimeoutRef.current = setTimeout(() => {
      setGameState("error");
      setErrorMsg("Game failed to load");
      submitScore(0);
    }, 5000);

    return () => {
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    };
  }, [gameState, submitScore]);

  // Countdown: 3-2-1-GO then start
  useEffect(() => {
    if (gameState !== "countdown") return;

    if (countdown <= 0) {
      setGameState("playing");
      hasPlayedRef.current = true;
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: "GAME_START" }, "*");
      }
      return;
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(timer);
  }, [gameState, countdown]);

  // Auto-submit score before round timer expires (primary submission path)
  useEffect(() => {
    if (gameState !== "playing" || !room.roundStartedAt) return;

    const timeLimit = currentRound?.timeLimit ?? 30;
    const elapsed = (Date.now() - room.roundStartedAt) / 1000;
    const remaining = Math.max(0, timeLimit - elapsed);

    // Submit 0.5s before timer expires — host advances 1.5s after timer hits 0
    const submitDelay = Math.max(0, (remaining - 0.5) * 1000);

    const timer = setTimeout(() => {
      if (!submittedRef.current) {
        submittedRef.current = true;
        const safe = Math.max(0, Math.floor(lastScoreRef.current) || 0);
        onScoreSubmit(safe);
      }
    }, submitDelay);

    return () => clearTimeout(timer);
  }, [gameState, room.roundStartedAt, currentRound?.timeLimit, onScoreSubmit]);

  // Health state machine: detects DEAD, STALLED, and BLANK games
  useEffect(() => {
    if (gameState !== "playing") return;

    // Reset health tracking when play starts
    lastMessageTimeRef.current = Date.now();
    const hb = lastHeartbeatRef.current;
    hb.time = Date.now();
    hb.prevFc = -1;
    hb.stalledCount = 0;
    hb.blankCount = 0;
    crashTimeoutRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceHb = now - hb.time;

      // DEAD: No heartbeat for 6s
      if (timeSinceHb > 6000) {
        setGameState("error");
        setErrorMsg("Game stopped responding");
        submitScore(lastScoreRef.current);
        return;
      }

      // Check heartbeat payload health
      if (hb.payload) {
        // STALLED: Heartbeat arrives but frame count not incrementing
        if (hb.prevFc >= 0 && hb.payload.fc === hb.prevFc) {
          hb.stalledCount++;
        } else {
          hb.stalledCount = 0;
        }
        hb.prevFc = hb.payload.fc;

        if (hb.stalledCount >= 2) {
          setGameState("error");
          setErrorMsg("Game stalled");
          submitScore(lastScoreRef.current);
          return;
        }

        // BLANK: Frame count incrementing but draws-per-frame is too low
        // A real game has 5+ draw calls per frame (bg + player + items + UI)
        // A blank game has 1-2 (just background fillRect)
        if (hb.payload.fc > 0 && hb.payload.dpf < 3) {
          hb.blankCount++;
        } else {
          hb.blankCount = 0;
        }

        if (hb.blankCount >= 3) {
          setGameState("error");
          setErrorMsg("Game not rendering");
          submitScore(lastScoreRef.current);
          return;
        }

      }
    }, 2000);

    return () => {
      if (crashTimeoutRef.current) clearInterval(crashTimeoutRef.current);
    };
  }, [gameState, submitScore]);

  return (
    <div className="relative w-full" style={{ aspectRatio: "16/10", maxHeight: "70vh" }}>
      {/* Iframe */}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={srcdoc}
        className="w-full h-full rounded-xl border-2 border-white/10"
        style={{ background: "#1a1a2e" }}
        title="Game"
      />

      {/* Score display during play */}
      {gameState === "playing" && (
        <>
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full font-mono font-bold text-sm">
            Score: {score}
          </div>
          <button
            onClick={() => {
              setGameState("complete");
              submitScore(lastScoreRef.current);
            }}
            className="absolute bottom-3 right-3 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white/60 hover:text-white px-3 py-1.5 rounded-full text-xs transition-all"
          >
            Skip →
          </button>
        </>
      )}

      {/* Countdown overlay */}
      <AnimatePresence>
        {gameState === "countdown" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl z-10"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-8xl font-display font-black text-white"
              style={{ textShadow: `0 0 40px ${theme.accentColor}` }}
            >
              {countdown > 0 ? countdown : "GO!"}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complete overlay */}
      {gameState === "complete" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl z-10">
          <div className="text-center">
            <div className="text-4xl font-display font-black text-white mb-2">
              Done!
            </div>
            <div className="text-2xl font-bold" style={{ color: theme.accentColor }}>
              {score} pts
            </div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {gameState === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl z-10">
          <div className="text-center">
            <div className="text-5xl mb-3">💥</div>
            <div className="text-xl font-bold text-white mb-1">{errorMsg}</div>
            <div className="text-sm text-white/60">Score submitted: {lastScoreRef.current}</div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {gameState === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl z-10">
          <div className="text-center">
            <div className="text-4xl mb-3 animate-bounce">🎮</div>
            <div className="text-white/80 text-sm">Loading game...</div>
          </div>
        </div>
      )}
    </div>
  );
}
