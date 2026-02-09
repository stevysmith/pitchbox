import { createNoise2D } from "simplex-noise";
import { SceneConfig, TILE_SIZE } from "./phaserTypes";

// Physics-safe level generation constraints
function getJumpReach(jumpForce: number, gravity: number) {
  const maxJumpHeight = (jumpForce * jumpForce) / (2 * gravity);
  const airTime = (2 * jumpForce) / gravity;
  return { maxJumpHeight, airTime };
}

// Default physics values matching scene defaults
const DEFAULT_PLATFORMER_JUMP = 450;
const DEFAULT_PLATFORMER_GRAVITY = 600;
const DEFAULT_RUNNER_JUMP = 400;
const DEFAULT_RUNNER_GRAVITY = 800;
const DEFAULT_CLIMBER_JUMP = 400;
const DEFAULT_CLIMBER_GRAVITY = 600;

// Tile types
export const TILE_EMPTY = 0;
export const TILE_GROUND = 1;
export const TILE_PLATFORM = 2;
export const TILE_HAZARD = 3;
export const TILE_COLLECTIBLE = 4;

export interface LevelData {
  tilemap: number[][];
  width: number;
  height: number;
  playerSpawnX: number;
  playerSpawnY: number;
  collectiblePositions: { x: number; y: number }[];
  hazardPositions: { x: number; y: number }[];
}

export function parseTilemap(config: SceneConfig): LevelData {
  const tilemap = config.tilemap;
  if (!tilemap || tilemap.length === 0) {
    return generateDefaultLevel(config);
  }

  const height = tilemap.length;
  const width = tilemap[0]?.length || 20;

  const collectiblePositions: { x: number; y: number }[] = [];
  const hazardPositions: { x: number; y: number }[] = [];
  let playerSpawnX = 2 * TILE_SIZE;
  let playerSpawnY = 2 * TILE_SIZE;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < (tilemap[y]?.length || 0); x++) {
      const tile = tilemap[y][x];
      if (tile === TILE_COLLECTIBLE) {
        collectiblePositions.push({ x: x * TILE_SIZE, y: y * TILE_SIZE });
      } else if (tile === TILE_HAZARD) {
        hazardPositions.push({ x: x * TILE_SIZE, y: y * TILE_SIZE });
      }
    }
  }

  // Find a good spawn point: first empty tile above ground
  for (let x = 1; x < width; x++) {
    for (let y = height - 2; y >= 0; y--) {
      if (
        tilemap[y][x] === TILE_EMPTY &&
        y + 1 < height &&
        (tilemap[y + 1][x] === TILE_GROUND || tilemap[y + 1][x] === TILE_PLATFORM)
      ) {
        playerSpawnX = x * TILE_SIZE + TILE_SIZE / 2;
        playerSpawnY = y * TILE_SIZE;
        break;
      }
    }
    if (playerSpawnY !== 2 * TILE_SIZE) break;
  }

  return {
    tilemap,
    width,
    height,
    playerSpawnX,
    playerSpawnY,
    collectiblePositions,
    hazardPositions,
  };
}

export function generateDefaultLevel(config: SceneConfig): LevelData {
  const noise2D = createNoise2D();
  const difficulty = config.difficulty || 3;

  switch (config.sceneType) {
    case "runner":
      return generateRunnerLevel(noise2D, difficulty, config);
    case "arena":
      return generateArenaLevel(noise2D, difficulty, config);
    case "platformer":
      return generatePlatformerLevel(noise2D, difficulty, config);
    case "dodge":
      return generateDodgeLevel(config);
    case "shooter":
      return generateShooterLevel(config);
    case "puzzle":
      return generatePuzzleLevel(config);
    case "catcher":
      return generateCatcherLevel(config);
    case "climber":
      return generateClimberLevel(config);
    case "memory":
      return generateMemoryLevel(config);
    case "sumo":
      return generateSumoLevel(config);
    default:
      return generateArenaLevel(noise2D, difficulty, config);
  }
}

function generateRunnerLevel(
  noise2D: (x: number, y: number) => number,
  difficulty: number,
  config: SceneConfig
): LevelData {
  const width = 100;
  const height = 15;
  const tilemap: number[][] = Array.from({ length: height }, () =>
    Array(width).fill(TILE_EMPTY)
  );

  const collectiblePositions: { x: number; y: number }[] = [];
  const hazardPositions: { x: number; y: number }[] = [];

  // Physics-aware constraints
  const jumpForce = config.physics?.jumpForce || DEFAULT_RUNNER_JUMP;
  const gravity = config.physics?.gravity || DEFAULT_RUNNER_GRAVITY;
  const scrollSpeed = config.runner?.scrollSpeed || config.physics?.scrollSpeed || 150;
  const { maxJumpHeight, airTime } = getJumpReach(jumpForce, gravity);
  // Max gap in tiles the player can clear (airtime × scrollSpeed / tileSize), with safety margin
  const maxGapTiles = Math.max(1, Math.floor((airTime * scrollSpeed) / TILE_SIZE * 0.7));
  // Max platform rise in tiles
  const maxPlatRise = Math.max(2, Math.floor((maxJumpHeight / TILE_SIZE) * 0.8));

  // Ground level varies with noise
  const groundLevel = height - 3;
  for (let x = 0; x < width; x++) {
    const noiseVal = noise2D(x * 0.1, 0);
    const groundY = groundLevel + Math.round(noiseVal);

    // Fill ground
    for (let y = Math.max(0, groundY); y < height; y++) {
      tilemap[y][x] = TILE_GROUND;
    }

    // Add gaps based on difficulty — capped to physics-safe maximum
    if (x > 5 && Math.random() < 0.03 * difficulty) {
      const gapWidth = Math.min(2 + Math.floor(difficulty / 2), maxGapTiles);
      for (let gx = 0; gx < gapWidth && x + gx < width; gx++) {
        for (let y = 0; y < height; y++) {
          tilemap[y][x + gx] = TILE_EMPTY;
        }
      }
    }

    // Floating platforms — capped to reachable height
    if (x > 3 && Math.random() < 0.08) {
      const riseOffset = Math.min(Math.floor(Math.random() * 3), maxPlatRise - 2);
      const platY = groundY - 2 - riseOffset;
      if (platY > 1) {
        for (let px = 0; px < 3 && x + px < width; px++) {
          tilemap[platY][x + px] = TILE_PLATFORM;
        }
        // Collectible on platform
        collectiblePositions.push({
          x: (x + 1) * TILE_SIZE,
          y: (platY - 1) * TILE_SIZE,
        });
      }
    }

    // Hazards on ground
    if (x > 8 && Math.random() < 0.04 * difficulty) {
      const hy = groundY - 1;
      if (hy > 0) {
        tilemap[hy][x] = TILE_HAZARD;
        hazardPositions.push({ x: x * TILE_SIZE, y: hy * TILE_SIZE });
      }
    }

    // Collectibles floating — capped to reachable height
    if (x > 2 && Math.random() < 0.06) {
      const maxFloatRise = Math.min(3, maxPlatRise);
      const cy = groundY - 2 - Math.floor(Math.random() * maxFloatRise);
      if (cy > 0 && tilemap[cy][x] === TILE_EMPTY) {
        collectiblePositions.push({ x: x * TILE_SIZE, y: cy * TILE_SIZE });
      }
    }
  }

  return {
    tilemap,
    width,
    height,
    playerSpawnX: 2 * TILE_SIZE,
    playerSpawnY: (groundLevel - 2) * TILE_SIZE,
    collectiblePositions,
    hazardPositions,
  };
}

function generateArenaLevel(
  noise2D: (x: number, y: number) => number,
  difficulty: number,
  config: SceneConfig
): LevelData {
  const arenaW = config.arena?.arenaWidth || 25;
  const arenaH = config.arena?.arenaHeight || 18;
  const tilemap: number[][] = Array.from({ length: arenaH }, () =>
    Array(arenaW).fill(TILE_EMPTY)
  );
  const collectiblePositions: { x: number; y: number }[] = [];
  const hazardPositions: { x: number; y: number }[] = [];

  // Border walls
  for (let x = 0; x < arenaW; x++) {
    tilemap[0][x] = TILE_GROUND;
    tilemap[arenaH - 1][x] = TILE_GROUND;
  }
  for (let y = 0; y < arenaH; y++) {
    tilemap[y][0] = TILE_GROUND;
    tilemap[y][arenaW - 1] = TILE_GROUND;
  }

  // Interior obstacles from noise
  for (let y = 3; y < arenaH - 3; y += 4) {
    for (let x = 3; x < arenaW - 3; x += 4) {
      if (noise2D(x * 0.3, y * 0.3) > 0.2) {
        tilemap[y][x] = TILE_GROUND;
        if (x + 1 < arenaW - 1) tilemap[y][x + 1] = TILE_GROUND;
      }
    }
  }

  // Scatter collectibles
  const numCollectibles = 8 + difficulty * 3;
  for (let i = 0; i < numCollectibles; i++) {
    let attempts = 0;
    while (attempts < 20) {
      const cx = 2 + Math.floor(Math.random() * (arenaW - 4));
      const cy = 2 + Math.floor(Math.random() * (arenaH - 4));
      if (tilemap[cy][cx] === TILE_EMPTY) {
        collectiblePositions.push({ x: cx * TILE_SIZE, y: cy * TILE_SIZE });
        break;
      }
      attempts++;
    }
  }

  // Scatter hazards
  const numHazards = difficulty * 2;
  for (let i = 0; i < numHazards; i++) {
    let attempts = 0;
    while (attempts < 20) {
      const hx = 3 + Math.floor(Math.random() * (arenaW - 6));
      const hy = 3 + Math.floor(Math.random() * (arenaH - 6));
      if (tilemap[hy][hx] === TILE_EMPTY) {
        tilemap[hy][hx] = TILE_HAZARD;
        hazardPositions.push({ x: hx * TILE_SIZE, y: hy * TILE_SIZE });
        break;
      }
      attempts++;
    }
  }

  return {
    tilemap,
    width: arenaW,
    height: arenaH,
    playerSpawnX: 3 * TILE_SIZE,
    playerSpawnY: 3 * TILE_SIZE,
    collectiblePositions,
    hazardPositions,
  };
}

function generatePlatformerLevel(
  noise2D: (x: number, y: number) => number,
  difficulty: number,
  config: SceneConfig
): LevelData {
  const width = 60;
  const height = 20;
  const tilemap: number[][] = Array.from({ length: height }, () =>
    Array(width).fill(TILE_EMPTY)
  );
  const collectiblePositions: { x: number; y: number }[] = [];
  const hazardPositions: { x: number; y: number }[] = [];

  // Physics-aware constraints
  const jumpForce = config.physics?.jumpForce || DEFAULT_PLATFORMER_JUMP;
  const gravity = config.physics?.gravity || DEFAULT_PLATFORMER_GRAVITY;
  const { maxJumpHeight } = getJumpReach(jumpForce, gravity);
  // Max rise in tiles, with 80% safety margin
  const maxTileRise = Math.max(2, Math.floor((maxJumpHeight / TILE_SIZE) * 0.8));

  // Ground
  const groundY = height - 2;
  for (let x = 0; x < width; x++) {
    for (let y = groundY; y < height; y++) {
      tilemap[y][x] = TILE_GROUND;
    }
  }

  // Platforms at various heights — capped to reachable jump height
  let lastPlatY = groundY; // Track last platform height for staircase constraint
  for (let x = 4; x < width - 3; x += 3 + Math.floor(Math.random() * 4)) {
    // Cap height: at most maxTileRise tiles above the previous platform
    const minY = Math.max(2, lastPlatY - maxTileRise);
    const maxY = groundY - 3;
    if (minY > maxY) continue;

    const platY = minY + Math.floor(Math.random() * (maxY - minY + 1));
    const platW = 2 + Math.floor(Math.random() * 3);
    for (let px = 0; px < platW && x + px < width; px++) {
      tilemap[platY][x + px] = TILE_PLATFORM;
    }

    // Collectible on some platforms (placed just above, always reachable)
    if (Math.random() < 0.6) {
      collectiblePositions.push({
        x: (x + Math.floor(platW / 2)) * TILE_SIZE,
        y: (platY - 1) * TILE_SIZE,
      });
    }

    // Hazard between platforms
    if (Math.random() < 0.15 * difficulty && x > 6) {
      const hy = groundY - 1;
      tilemap[hy][x - 1] = TILE_HAZARD;
      hazardPositions.push({ x: (x - 1) * TILE_SIZE, y: hy * TILE_SIZE });
    }

    lastPlatY = platY;
  }

  return {
    tilemap,
    width,
    height,
    playerSpawnX: 2 * TILE_SIZE,
    playerSpawnY: (groundY - 2) * TILE_SIZE,
    collectiblePositions,
    hazardPositions,
  };
}

function generateDodgeLevel(config: SceneConfig): LevelData {
  const width = 20;
  const height = 15;
  const tilemap: number[][] = Array.from({ length: height }, () =>
    Array(width).fill(TILE_EMPTY)
  );

  // Ground at bottom
  for (let x = 0; x < width; x++) {
    tilemap[height - 1][x] = TILE_GROUND;
  }
  // Walls
  for (let y = 0; y < height; y++) {
    tilemap[y][0] = TILE_GROUND;
    tilemap[y][width - 1] = TILE_GROUND;
  }

  return {
    tilemap,
    width,
    height,
    playerSpawnX: Math.floor(width / 2) * TILE_SIZE,
    playerSpawnY: (height - 3) * TILE_SIZE,
    collectiblePositions: [],
    hazardPositions: [],
  };
}

function generateShooterLevel(config: SceneConfig): LevelData {
  const width = 25;
  const height = 18;
  const tilemap: number[][] = Array.from({ length: height }, () =>
    Array(width).fill(TILE_EMPTY)
  );

  return {
    tilemap,
    width,
    height,
    playerSpawnX: Math.floor(width / 2) * TILE_SIZE,
    playerSpawnY: (height - 3) * TILE_SIZE,
    collectiblePositions: [],
    hazardPositions: [],
  };
}

function generatePuzzleLevel(config: SceneConfig): LevelData {
  const gridW = config.puzzle?.gridWidth || 6;
  const gridH = config.puzzle?.gridHeight || 6;
  const tilemap: number[][] = Array.from({ length: gridH }, () =>
    Array(gridW).fill(TILE_EMPTY)
  );

  return {
    tilemap,
    width: gridW,
    height: gridH,
    playerSpawnX: 0,
    playerSpawnY: 0,
    collectiblePositions: [],
    hazardPositions: [],
  };
}

function generateCatcherLevel(config: SceneConfig): LevelData {
  const width = 20;
  const height = 15;
  const tilemap: number[][] = Array.from({ length: height }, () =>
    Array(width).fill(TILE_EMPTY)
  );

  // Ground at bottom
  for (let x = 0; x < width; x++) {
    tilemap[height - 1][x] = TILE_GROUND;
  }
  // Walls
  for (let y = 0; y < height; y++) {
    tilemap[y][0] = TILE_GROUND;
    tilemap[y][width - 1] = TILE_GROUND;
  }

  return {
    tilemap,
    width,
    height,
    playerSpawnX: Math.floor(width / 2) * TILE_SIZE,
    playerSpawnY: (height - 3) * TILE_SIZE,
    collectiblePositions: [],
    hazardPositions: [],
  };
}

function generateClimberLevel(config: SceneConfig): LevelData {
  const width = 20;
  const height = 60; // Tall vertical shaft
  const tilemap: number[][] = Array.from({ length: height }, () =>
    Array(width).fill(TILE_EMPTY)
  );
  const collectiblePositions: { x: number; y: number }[] = [];

  // Physics-aware constraints
  const jumpForce = config.climber?.bounceForce || DEFAULT_CLIMBER_JUMP;
  const gravity = config.physics?.gravity || DEFAULT_CLIMBER_GRAVITY;
  const playerSpeed = config.physics?.playerSpeed || 200;
  const { maxJumpHeight, airTime } = getJumpReach(jumpForce, gravity);
  // Max horizontal reach in tiles during a jump (with 70% safety margin for diagonal)
  const maxHorizReach = Math.max(3, Math.floor((playerSpeed * airTime * 0.7) / TILE_SIZE));

  // Walls on sides
  for (let y = 0; y < height; y++) {
    tilemap[y][0] = TILE_GROUND;
    tilemap[y][width - 1] = TILE_GROUND;
  }

  // Ground at bottom
  for (let x = 0; x < width; x++) {
    tilemap[height - 1][x] = TILE_GROUND;
  }

  // Starting platform
  for (let x = 3; x < width - 3; x++) {
    tilemap[height - 3][x] = TILE_PLATFORM;
  }

  // Scatter platforms going upward — constrain horizontal offset for reachability
  let lastPlatX = Math.floor(width / 2); // Start near center
  for (let y = height - 6; y > 2; y -= (2 + Math.floor(Math.random() * 2))) {
    const platW = 3 + Math.floor(Math.random() * 3);

    // Constrain X: next platform must be within horizontal jump reach of previous
    const minX = Math.max(2, lastPlatX - maxHorizReach);
    const maxX = Math.min(width - platW - 2, lastPlatX + maxHorizReach);
    const platX = minX + Math.floor(Math.random() * Math.max(1, maxX - minX + 1));

    for (let px = 0; px < platW && platX + px < width - 1; px++) {
      tilemap[y][platX + px] = TILE_PLATFORM;
    }
    // Collectible on some platforms
    if (Math.random() < 0.4) {
      collectiblePositions.push({
        x: (platX + Math.floor(platW / 2)) * TILE_SIZE,
        y: (y - 1) * TILE_SIZE,
      });
    }

    lastPlatX = platX + Math.floor(platW / 2); // Track center of platform
  }

  return {
    tilemap,
    width,
    height,
    playerSpawnX: Math.floor(width / 2) * TILE_SIZE,
    playerSpawnY: (height - 4) * TILE_SIZE,
    collectiblePositions,
    hazardPositions: [],
  };
}

function generateMemoryLevel(config: SceneConfig): LevelData {
  // Memory doesn't use tilemap — grid is generated in the scene
  const gridSize = config.memory?.gridSize || 4;
  const tilemap: number[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(TILE_EMPTY)
  );

  return {
    tilemap,
    width: gridSize,
    height: gridSize,
    playerSpawnX: 0,
    playerSpawnY: 0,
    collectiblePositions: [],
    hazardPositions: [],
  };
}

function generateSumoLevel(config: SceneConfig): LevelData {
  // Sumo uses a circular platform drawn with graphics, not tilemap
  const size = 25;
  const tilemap: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(TILE_EMPTY)
  );

  return {
    tilemap,
    width: size,
    height: size,
    playerSpawnX: Math.floor(size / 2) * TILE_SIZE,
    playerSpawnY: Math.floor(size / 2) * TILE_SIZE,
    collectiblePositions: [],
    hazardPositions: [],
  };
}
