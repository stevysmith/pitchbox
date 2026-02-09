export type SceneType =
  | "runner"
  | "arena"
  | "platformer"
  | "dodge"
  | "shooter"
  | "puzzle"
  | "catcher"
  | "climber"
  | "memory"
  | "sumo";

export type ArtStyle = "modern" | "pixel";

export interface EntitySpawn {
  type: string;
  x: number;
  y: number;
  properties?: Record<string, any>;
}

export interface ScoringRules {
  collectiblePoints: number;
  survivalBonusPerSecond: number;
  completionBonus: number;
  speedBonusMultiplier: number;
}

export interface SceneConfig {
  sceneType: SceneType;
  theme: string;
  difficulty: number; // 1-5
  timeLimit: number; // seconds
  tilemap: number[][]; // 2D array: 0=empty, 1=ground, 2=platform, 3=hazard, 4=collectible
  entities: EntitySpawn[];
  scoring: ScoringRules;
  colors: {
    sky: string;
    ground: string;
    platform: string;
    hazard: string;
    collectible: string;
    player: string;
  };
  physics?: {
    gravity?: number;
    playerSpeed?: number;
    jumpForce?: number;
    scrollSpeed?: number;
  };
  // Scene-specific config
  runner?: {
    scrollSpeed: number;
    obstacleFrequency: number;
    gapSize: number;
  };
  arena?: {
    itemSpawnRate: number;
    hazardPattern: string;
    arenaWidth: number;
    arenaHeight: number;
  };
  platformer?: {
    checkpoints: number[];
  };
  dodge?: {
    spawnPattern: string;
    speedCurve: number;
    objectTypes: string[];
  };
  shooter?: {
    targetTypes: string[];
    spawnInterval: number;
    targetSpeed: number;
  };
  puzzle?: {
    gridWidth: number;
    gridHeight: number;
    tileTypes: number;
    matchRule: string;
  };
  catcher?: {
    goodItemRate: number;
    badItemRate: number;
    fallSpeed: number;
    badItemPenalty: number;
  };
  climber?: {
    scrollSpeed: number;
    platformDensity: number;
    bounceForce: number;
  };
  memory?: {
    startLength: number;
    flashDuration: number;
    gridSize: number;
  };
  sumo?: {
    platformRadius: number;
    shrinkRate: number;
    knockbackForce: number;
    dashCooldown: number;
  };
  spriteImages?: {
    player?: string;
    collectible?: string;
    hazard?: string;
    background?: string;
    ground?: string;
    platform?: string;
  };
  artStyle?: ArtStyle;
}

export interface PhaserRoundConfig {
  title: string;
  description: string;
  type: "phaser-game";
  timeLimit: number;
  config: SceneConfig;
  pointsMultiplier?: number;
}

export interface PhaserGameDefinition {
  title: string;
  tagline: string;
  theme: {
    emoji: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    mood: string;
  };
  settings: {
    minPlayers: number;
    maxPlayers: number;
  };
  rounds: PhaserRoundConfig[];
}

export interface PlayerPosition {
  playerId: string;
  playerName: string;
  playerEmoji: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  animation: string;
  color: string;
}

export interface RemotePlayerState {
  playerId: string;
  playerName: string;
  playerEmoji: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  animation: string;
  color: string;
  lastUpdate: number;
}

// Player color palette for distinguishing players
export const PLAYER_COLORS = [
  "#e74c3c", // red
  "#3498db", // blue
  "#2ecc71", // green
  "#f39c12", // orange
  "#9b59b6", // purple
  "#1abc9c", // teal
  "#e91e63", // pink
  "#ff9800", // amber
  "#00bcd4", // cyan
  "#8bc34a", // light green
  "#ff5722", // deep orange
  "#607d8b", // blue grey
];

// Tile size for the pixel art grid
export const TILE_SIZE = 16;
export const SCALED_TILE_SIZE = 32; // rendered at 2x

// Display sizes for game entities (visual only — physics bodies unchanged)
export const PLAYER_DISPLAY_SIZE = TILE_SIZE * 3;       // 48px
export const COLLECTIBLE_DISPLAY_SIZE = TILE_SIZE * 2.5; // 40px
export const HAZARD_DISPLAY_SIZE = TILE_SIZE * 2.5;      // 40px
