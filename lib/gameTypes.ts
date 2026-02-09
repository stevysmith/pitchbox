import { SceneConfig } from "./phaserTypes";

export type RoundType = "phaser-game" | "html-game";

export type Mood = "silly" | "competitive" | "creative" | "chill" | "chaotic" | "spicy" | "wholesome";

export interface GameTheme {
  emoji: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  mood: Mood;
}

export interface RoundConfig {
  // Phaser game config
  sceneType?: string;
  theme?: string;
  difficulty?: number;
  timeLimit?: number;
  tilemap?: number[][];
  entities?: any[];
  scoring?: {
    collectiblePoints: number;
    survivalBonusPerSecond: number;
    completionBonus: number;
    speedBonusMultiplier: number;
  };
  colors?: {
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
    checkpoints?: number[];
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
}

export interface GameRound {
  title: string;
  description: string;
  type: RoundType;
  timeLimit: number;
  config: RoundConfig;
  gameCode?: string;
  pointsMultiplier?: number;
}

export interface SpriteImages {
  player?: string;
  collectible?: string;
  hazard?: string;
  background?: string;
  ground?: string;
  platform?: string;
}

export interface GameDefinition {
  title: string;
  tagline: string;
  theme: GameTheme;
  settings: {
    minPlayers: number;
    maxPlayers: number;
  };
  rounds: GameRound[];
  spriteImages?: SpriteImages;
  artStyle?: "modern" | "pixel";
}

export type RoomStatus = "lobby" | "playing" | "finished";
export type RoundPhase = "intro" | "submit" | "vote" | "reveal" | "scores";

export const PLAYER_EMOJIS = [
  "🦊", "🐙", "🌵", "🍕", "🎸", "🚀", "🦄", "🐸",
  "🔥", "💀", "👽", "🤖", "🎭", "🧊", "⚡", "🌈",
  "🦋", "🍄", "🎪", "🫠", "🤠", "👾", "🧃", "🫧",
];

export const EXAMPLE_PROMPTS = [
  "We're a team of space pirates fighting over the last slice of cosmic pizza",
  "90s internet vibes — dialup sounds, AIM away messages, and terrible fonts",
  "Our team is trapped in a reality TV cooking show but nobody can cook",
  "Gen Z vs millennials: who has the worse survival skills?",
  "We're NPCs in a badly designed video game trying to unionize",
  "A nature documentary but it's about our office Slack channels",
  "Time traveling foodies reviewing restaurants across different centuries",
  "Our standup meeting is actually a competitive rap battle",
];
