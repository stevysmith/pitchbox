import * as Phaser from "phaser";

// Pixel art patterns for procedural sprite generation
// Each pattern is an 8x8 or 16x16 grid of color indices

const PLAYER_PATTERN_8x8 = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 2, 1, 1, 2, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 3, 3, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 0, 1, 1, 0, 1, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
];

const COLLECTIBLE_PATTERN = [
  [0, 0, 1, 1, 1, 0, 0, 0],
  [0, 1, 2, 2, 1, 1, 0, 0],
  [1, 2, 2, 2, 2, 1, 0, 0],
  [1, 2, 2, 2, 2, 2, 1, 0],
  [1, 2, 2, 2, 2, 2, 1, 0],
  [0, 1, 2, 2, 2, 1, 0, 0],
  [0, 0, 1, 2, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0],
];

const HAZARD_PATTERN = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [1, 2, 2, 3, 3, 2, 2, 1],
  [1, 2, 2, 3, 3, 2, 2, 1],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
];

const TARGET_PATTERN = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 2, 2, 1, 1, 0],
  [1, 1, 2, 2, 2, 2, 1, 1],
  [1, 2, 2, 3, 3, 2, 2, 1],
  [1, 2, 2, 3, 3, 2, 2, 1],
  [1, 1, 2, 2, 2, 2, 1, 1],
  [0, 1, 1, 2, 2, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 0, 0],
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
}

function lighten(hex: string, amount: number): number {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.min(255, r + amount);
  const lg = Math.min(255, g + amount);
  const lb = Math.min(255, b + amount);
  return (lr << 16) | (lg << 8) | lb;
}

function darken(hex: string, amount: number): number {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.max(0, r - amount);
  const dg = Math.max(0, g - amount);
  const db = Math.max(0, b - amount);
  return (dr << 16) | (dg << 8) | db;
}

function hexToNum(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

function renderPattern(
  scene: Phaser.Scene,
  key: string,
  pattern: number[][],
  colors: number[], // index 0 = transparent, 1+ = colors
  scale: number = 4
): void {
  const size = pattern.length;
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = pattern[y][x];
      if (idx === 0) continue;
      const color = colors[idx];
      ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}

export function createPlayerSprite(
  scene: Phaser.Scene,
  playerId: string,
  color: string
): void {
  const key = `player_${playerId}`;
  if (scene.textures.exists(key)) return;

  const base = hexToNum(color);
  const light = lighten(color, 60);
  const eye = 0x222222;
  const mouth = darken(color, 80);

  renderPattern(scene, key, PLAYER_PATTERN_8x8, [0, base, eye, mouth], 4);
}

export function createCollectibleSprite(
  scene: Phaser.Scene,
  color: string = "#ffd700"
): void {
  const key = "collectible";
  if (scene.textures.exists(key)) return;

  const base = hexToNum(color);
  const light = lighten(color, 80);

  renderPattern(scene, key, COLLECTIBLE_PATTERN, [0, darken(color, 40), base, light], 4);
}

export function createHazardSprite(
  scene: Phaser.Scene,
  color: string = "#ff4444"
): void {
  const key = "hazard";
  if (scene.textures.exists(key)) return;

  const base = hexToNum(color);
  const light = lighten(color, 60);
  const core = lighten(color, 120);

  renderPattern(scene, key, HAZARD_PATTERN, [0, darken(color, 60), base, core], 4);
}

export function createTargetSprite(
  scene: Phaser.Scene,
  color: string = "#ff6600"
): void {
  const key = "target";
  if (scene.textures.exists(key)) return;

  const ring1 = hexToNum(color);
  const ring2 = 0xffffff;
  const bullseye = hexToNum("#ff0000");

  renderPattern(scene, key, TARGET_PATTERN, [0, ring1, ring2, bullseye], 4);
}

export function createGroundTile(
  scene: Phaser.Scene,
  color: string = "#4a7c59"
): void {
  const key = "ground_tile";
  if (scene.textures.exists(key)) return;

  const size = 8;
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;

  const base = hexToRgb(color);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Vertical gradient: lighter top → darker bottom
      const gradientShift = Math.round((y / (size - 1)) * -20 + 10);
      const variation = ((x * 7 + y * 13) % 5) - 2;

      let r = base.r + variation * 8 + gradientShift;
      let g = base.g + variation * 8 + gradientShift;
      let b = base.b + variation * 8 + gradientShift;

      // Top highlight row
      if (y === 0) { r += 30; g += 30; b += 30; }
      // Bottom shadow row
      if (y === size - 1) { r -= 25; g -= 25; b -= 25; }
      // Side border pixels (subtle darken)
      if (x === 0 || x === size - 1) { r -= 12; g -= 12; b -= 12; }

      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}

export function createPlatformTile(
  scene: Phaser.Scene,
  color: string = "#8b6914"
): void {
  const key = "platform_tile";
  if (scene.textures.exists(key)) return;

  const size = 8;
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;

  const base = hexToRgb(color);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Vertical gradient: lighter top → darker bottom
      const gradientShift = Math.round((y / (size - 1)) * -16 + 8);
      const variation = ((x * 3 + y * 7) % 3) - 1;

      let r = base.r + variation * 6 + gradientShift;
      let g = base.g + variation * 6 + gradientShift;
      let b = base.b + variation * 6 + gradientShift;

      // Top highlight row (brighter)
      if (y === 0) { r += 45; g += 45; b += 45; }
      // Second row — subtle highlight
      if (y === 1) { r += 15; g += 15; b += 15; }
      // Bottom shadow row
      if (y === size - 1) { r -= 30; g -= 30; b -= 30; }
      // Side border pixels
      if (x === 0 || x === size - 1) { r -= 10; g -= 10; b -= 10; }

      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}

export function createModernGroundTile(
  scene: Phaser.Scene,
  color: string = "#4a7c59"
): void {
  const key = "ground_tile";
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = hexToRgb(color);

  // Smooth vertical gradient: lighter top → darker bottom
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, `rgb(${Math.min(255, base.r + 18)},${Math.min(255, base.g + 18)},${Math.min(255, base.b + 18)})`);
  grad.addColorStop(1, `rgb(${Math.max(0, base.r - 18)},${Math.max(0, base.g - 18)},${Math.max(0, base.b - 18)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Top highlight line
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(0, 0, size, 2);

  // Bottom shadow line
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(0, size - 2, size, 2);

  // Subtle noise dots for organic texture
  for (let i = 0; i < 40; i++) {
    const nx = Math.random() * size;
    const ny = Math.random() * size;
    const bright = Math.random() > 0.5;
    ctx.fillStyle = bright ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(nx, ny, 1, 1);
  }

  scene.textures.addCanvas(key, canvas);
  // Ensure smooth (LINEAR) filtering for modern tiles
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export function createModernPlatformTile(
  scene: Phaser.Scene,
  color: string = "#8b6914"
): void {
  const key = "platform_tile";
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = hexToRgb(color);

  // Multi-stop vertical gradient
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, `rgb(${Math.min(255, base.r + 35)},${Math.min(255, base.g + 35)},${Math.min(255, base.b + 35)})`);
  grad.addColorStop(0.15, `rgb(${Math.min(255, base.r + 10)},${Math.min(255, base.g + 10)},${Math.min(255, base.b + 10)})`);
  grad.addColorStop(0.85, `rgb(${base.r},${base.g},${base.b})`);
  grad.addColorStop(1, `rgb(${Math.max(0, base.r - 25)},${Math.max(0, base.g - 25)},${Math.max(0, base.b - 25)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Feathered top highlight (6px gradient fade)
  const topHighlight = ctx.createLinearGradient(0, 0, 0, 6);
  topHighlight.addColorStop(0, "rgba(255,255,255,0.2)");
  topHighlight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = topHighlight;
  ctx.fillRect(0, 0, size, 6);

  // Bottom shadow (4px gradient)
  const bottomShadow = ctx.createLinearGradient(0, size - 4, 0, size);
  bottomShadow.addColorStop(0, "rgba(0,0,0,0)");
  bottomShadow.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = bottomShadow;
  ctx.fillRect(0, size - 4, size, 4);

  // Subtle inner line detail (stone joint / wood grain effect)
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(size * 0.4));
  ctx.lineTo(size, Math.round(size * 0.4));
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.moveTo(0, Math.round(size * 0.4) + 1);
  ctx.lineTo(size, Math.round(size * 0.4) + 1);
  ctx.stroke();

  // Subtle noise dots
  for (let i = 0; i < 30; i++) {
    const nx = Math.random() * size;
    const ny = Math.random() * size;
    const bright = Math.random() > 0.5;
    ctx.fillStyle = bright ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(nx, ny, 1, 1);
  }

  scene.textures.addCanvas(key, canvas);
  // Ensure smooth (LINEAR) filtering for modern tiles
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export function createSkyBackground(
  scene: Phaser.Scene,
  color: string = "#1a1a2e"
): void {
  const key = "sky_bg";
  if (scene.textures.exists(key)) return;

  const width = 320;
  const height = 240;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const top = hexToRgb(color);
  const bottom = {
    r: Math.min(255, top.r + 30),
    g: Math.min(255, top.g + 20),
    b: Math.min(255, top.b + 40),
  };

  for (let y = 0; y < height; y++) {
    const t = y / height;
    const r = Math.round(top.r + (bottom.r - top.r) * t);
    const g = Math.round(top.g + (bottom.g - top.g) * t);
    const b = Math.round(top.b + (bottom.b - top.b) * t);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, width, 1);
  }

  // Simple pixel stars
  for (let i = 0; i < 30; i++) {
    const sx = Math.floor(Math.random() * width);
    const sy = Math.floor(Math.random() * (height * 0.6));
    const brightness = 150 + Math.floor(Math.random() * 105);
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness + 20})`;
    ctx.fillRect(sx, sy, 2, 2);
  }

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}

export function createPuzzleTile(
  scene: Phaser.Scene,
  index: number,
  color: string
): void {
  const key = `puzzle_tile_${index}`;
  if (scene.textures.exists(key)) return;

  const size = 8;
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;

  const base = hexToRgb(color);

  // Fill with base color + border
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isBorder = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const r = isBorder ? Math.max(0, base.r - 40) : base.r;
      const g = isBorder ? Math.max(0, base.g - 40) : base.g;
      const b = isBorder ? Math.max(0, base.b - 40) : base.b;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}

export function createCrosshairSprite(scene: Phaser.Scene): void {
  const key = "crosshair";
  if (scene.textures.exists(key)) return;

  const size = 16;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;

  const center = Math.floor(size / 2);
  ctx.fillStyle = "#ffffff";

  // Horizontal line
  for (let x = 2; x < size - 2; x++) {
    if (Math.abs(x - center) > 1) {
      ctx.fillRect(x * scale, center * scale, scale, scale);
    }
  }
  // Vertical line
  for (let y = 2; y < size - 2; y++) {
    if (Math.abs(y - center) > 1) {
      ctx.fillRect(center * scale, y * scale, scale, scale);
    }
  }
  // Center dot
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(center * scale, center * scale, scale, scale);

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}
