"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { SceneConfig, SceneType } from "../lib/phaserTypes";
import { EventBus } from "../lib/EventBus";
import type { BaseSceneData } from "../scenes/BaseScene";

interface PhaserGameProps {
  config: SceneConfig;
  room: Doc<"rooms">;
  currentPlayer: Doc<"players">;
  players: Doc<"players">[];
  roundIndex: number;
  onScoreSubmit: (score: number) => void;
}

const SCENE_MAP: Record<SceneType, () => Promise<any>> = {
  runner: () => import("../scenes/RunnerScene").then((m) => m.RunnerScene),
  arena: () => import("../scenes/ArenaScene").then((m) => m.ArenaScene),
  platformer: () => import("../scenes/PlatformerScene").then((m) => m.PlatformerScene),
  dodge: () => import("../scenes/DodgeScene").then((m) => m.DodgeScene),
  shooter: () => import("../scenes/ShooterScene").then((m) => m.ShooterScene),
  puzzle: () => import("../scenes/PuzzleScene").then((m) => m.PuzzleScene),
  catcher: () => import("../scenes/CatcherScene").then((m) => m.CatcherScene),
  climber: () => import("../scenes/ClimberScene").then((m) => m.ClimberScene),
  memory: () => import("../scenes/MemoryScene").then((m) => m.MemoryScene),
  sumo: () => import("../scenes/SumoScene").then((m) => m.SumoScene),
};

export function PhaserGame({
  config,
  room,
  currentPlayer,
  players,
  roundIndex,
  onScoreSubmit,
}: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const scoreSubmittedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updatePosition = useMutation(api.positions.updatePosition);
  const positions = useQuery(api.positions.getPositions, {
    roomId: room._id,
    round: roundIndex,
  });

  // Feed position updates into active scene's multiplayer manager
  useEffect(() => {
    if (!positions || !gameRef.current) return;
    const game = gameRef.current;
    // Guard: game may have been destroyed between render and effect
    if (!game.scene || !game.isRunning) return;
    try {
      const scenes = game.scene.getScenes(true);
      for (const scene of scenes) {
        if ((scene as any).multiplayer && (scene as any).sys && !(scene as any)._destroyed) {
          (scene as any).multiplayer.updateRemotePlayers(positions);
        }
      }
    } catch {
      // Game was destroyed between check and access — ignore
    }
  }, [positions]);

  // Handle round completion
  const handleRoundComplete = useCallback(
    (data: { score: number; playerId: string; round: number }) => {
      if (scoreSubmittedRef.current) return;
      scoreSubmittedRef.current = true;
      onScoreSubmit(data.score);
    },
    [onScoreSubmit]
  );

  useEffect(() => {
    EventBus.on("round-complete", handleRoundComplete);
    return () => {
      EventBus.off("round-complete", handleRoundComplete);
    };
  }, [handleRoundComplete]);

  // Initialize Phaser game
  useEffect(() => {
    if (!containerRef.current) return;

    let game: any = null;
    let destroyed = false;
    scoreSubmittedRef.current = false;

    async function initPhaser() {
      try {
        const Phaser = (await import("phaser")).default;

        const sceneType = config.sceneType || "arena";
        const [SceneClass, { CountdownScene }, { UIScene }] = await Promise.all([
          SCENE_MAP[sceneType](),
          import("../scenes/CountdownScene"),
          import("../scenes/UIScene"),
        ]);

        if (destroyed) return;

        const playerIndex = players.findIndex((p) => p._id === currentPlayer._id);

        const sceneData: BaseSceneData = {
          config,
          playerId: currentPlayer._id,
          playerName: currentPlayer.name,
          playerEmoji: currentPlayer.emoji,
          playerIndex: playerIndex >= 0 ? playerIndex : 0,
          roomId: room._id,
          round: roundIndex,
          updatePositionMutation: updatePosition,
          allPlayers: players.map((p) => ({
            _id: p._id,
            name: p.name,
            emoji: p.emoji,
          })),
        };

        // Create a wrapper scene class that passes data via init
        class GameScene extends SceneClass {
          init() {
            super.init(sceneData);
          }
        }

        const isPixelArt = config.artStyle === "pixel";
        const phaserConfig: any = {
          type: Phaser.AUTO,
          parent: containerRef.current!,
          width: Math.min(960, window.innerWidth),
          height: Math.min(540, window.innerHeight - 200),
          pixelArt: isPixelArt,
          roundPixels: isPixelArt,
          antialias: !isPixelArt,
          audio: { disableWebAudio: false },
          physics: {
            default: "arcade",
            arcade: {
              gravity: {
                x: 0,
                y: sceneType === "arena" || sceneType === "shooter" || sceneType === "puzzle" || sceneType === "memory" || sceneType === "sumo"
                  ? 0
                  : config.physics?.gravity || 600,
              },
              debug: false,
            },
          },
          scene: [GameScene, CountdownScene, UIScene],
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          backgroundColor: "#0a0a0b",
        };

        if (destroyed) return;

        game = new Phaser.Game(phaserConfig);
        gameRef.current = game;

        // Scene ready listener
        const onSceneReady = () => {
          if (!destroyed) setLoading(false);
        };
        EventBus.on("scene-ready", onSceneReady);

        // Fallback: if scene doesn't emit ready within 2s
        setTimeout(() => {
          if (!destroyed) setLoading(false);
        }, 2000);
      } catch (err: any) {
        if (!destroyed) {
          console.error("Phaser init error:", err);
          setError(err.message || "Failed to load game");
          setLoading(false);
        }
      }
    }

    initPhaser();

    return () => {
      destroyed = true;
      // Clear ref BEFORE destroying so concurrent effects don't access dead scenes
      gameRef.current = null;
      EventBus.removeAllListeners("scene-ready");
      EventBus.removeAllListeners("remote-players-updated");
      EventBus.removeAllListeners("timer-update");
      EventBus.removeAllListeners("score-update");
      EventBus.removeAllListeners("countdown-complete");
      EventBus.removeAllListeners("countdown-sfx");
      if (game) {
        game.destroy(true);
      }
    };
  }, [config.sceneType, roundIndex]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="text-4xl">💥</div>
        <p className="text-hot font-medium">Failed to load game</p>
        <p className="text-text-muted text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/80 z-10">
          <div className="text-center space-y-3">
            <div className="text-4xl animate-bounce">🎮</div>
            <p className="text-text-muted text-sm font-mono">Loading game...</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-white/10"
        style={{ minHeight: 300 }}
      />
    </div>
  );
}
