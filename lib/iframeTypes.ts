// PostMessage protocol between parent (IframeGame) and child (sandboxed iframe game)

// --- Parent → Iframe ---

export interface GameInitPayload {
  player: {
    id: string;
    name: string;
    emoji: string;
    color: string;
    index: number;
  };
  config: {
    timeLimit: number;
    difficulty: number;
    theme: string;
  };
  sprites: {
    player?: string;
    collectible?: string;
    hazard?: string;
    background?: string;
  };
  theme: {
    emoji: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
}

export type IframeInboundMessage =
  | { type: "GAME_INIT"; payload: GameInitPayload }
  | { type: "GAME_START" }
  | { type: "GAME_END" };

// --- Iframe → Parent ---

export interface HeartbeatPayload {
  fc: number;    // Frame count since start
  dpf: number;   // Draw calls per frame since last heartbeat (real game ≥5, blank ≤2)
  score: number; // Current score
  err: number;   // Total RAF error count
}

export interface GameErrorPayload {
  message: string;
  fatal?: boolean;
}

export type IframeOutboundMessage =
  | { type: "GAME_READY" }
  | { type: "HEARTBEAT"; payload?: HeartbeatPayload }
  | { type: "SCORE_UPDATE"; payload: { score: number } }
  | { type: "GAME_COMPLETE"; payload: { score: number } }
  | { type: "GAME_ERROR"; payload: GameErrorPayload };
