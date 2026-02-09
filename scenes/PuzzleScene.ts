import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE } from "../lib/phaserTypes";
import { EventBus } from "../lib/EventBus";
import { createPuzzleTile } from "../lib/SpriteFactory";
import { JuiceManager } from "../lib/JuiceManager";
import { AudioManager } from "../lib/AudioManager";

const PUZZLE_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];

export class PuzzleScene extends BaseScene {
  private gridWidth: number = 6;
  private gridHeight: number = 6;
  private tileTypes: number = 4;
  private grid: number[][] = [];
  private tileSprites: (Phaser.GameObjects.Sprite | null)[][] = [];
  private selectedTile: { x: number; y: number } | null = null;
  private tileSize: number = 48;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private matchesFound: number = 0;
  private processing: boolean = false;

  constructor() {
    super("PuzzleScene");
  }

  preload(): void {
    super.preload();
    // Create puzzle tile textures for each type
    for (let i = 0; i < 6; i++) {
      createPuzzleTile(this, i, PUZZLE_COLORS[i]);
    }
  }

  create(): void {
    // Don't call super.create() -- puzzle doesn't need tilemap/physics player
    // Initialize juice & audio manually
    JuiceManager.ensureWhiteTexture(this);
    this.juice = new JuiceManager(this);
    this.audio = new AudioManager();
    this.audio.resume();

    this.roundActive = true;
    this.score = 0;

    this.gridWidth = this.config.puzzle?.gridWidth || 6;
    this.gridHeight = this.config.puzzle?.gridHeight || 6;
    this.tileTypes = Math.min(this.config.puzzle?.tileTypes || 4, 6);

    // Calculate grid layout
    const cam = this.cameras.main;
    this.tileSize = Math.min(
      Math.floor((cam.width - 40) / this.gridWidth),
      Math.floor((cam.height - 100) / this.gridHeight),
      56
    );
    this.gridOffsetX = (cam.width - this.gridWidth * this.tileSize) / 2;
    this.gridOffsetY = 50;

    // Background
    this.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x1a1a2e);

    // Initialize grid
    this.initializeGrid();
    this.renderGrid();

    // Input: click/tap on tiles
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.processing || !this.roundActive) return;
      const gx = Math.floor((pointer.x - this.gridOffsetX) / this.tileSize);
      const gy = Math.floor((pointer.y - this.gridOffsetY) / this.tileSize);
      if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
        this.onTileClicked(gx, gy);
      }
    });

    // HUD — launch parallel UIScene + keep local refs
    this.scene.launch("UIScene");
    this.createHUD();

    // Timer
    this.timeLeft = this.config.timeLimit || 30;
    this.time.addEvent({
      delay: 1000,
      callback: this.tickTimer,
      callbackScope: this,
      loop: true,
    });

    // Multiplayer
    this.boundOnRemotePlayersUpdated = this.onRemotePlayersUpdated.bind(this);
    EventBus.on("remote-players-updated", this.boundOnRemotePlayersUpdated);

    // Countdown overlay
    this.roundActive = false;
    this.scene.launch("CountdownScene");
    const onCountdownComplete = () => {
      this.roundActive = true;
      this.audio?.startBGM();
      EventBus.off("countdown-complete", onCountdownComplete);
    };
    EventBus.on("countdown-complete", onCountdownComplete);
    const onCountdownSfx = (type: string) => {
      this.audio?.playSFX(type as any);
    };
    EventBus.on("countdown-sfx", onCountdownSfx);
    this.events.on("shutdown", () => {
      EventBus.off("countdown-sfx", onCountdownSfx);
    });

    this.cameras.main.fadeIn(400);
    EventBus.emit("scene-ready", this.scene.key);
  }

  private initializeGrid(): void {
    this.grid = [];
    for (let y = 0; y < this.gridHeight; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        this.grid[y][x] = Math.floor(Math.random() * this.tileTypes);
      }
    }
    // Ensure no initial matches
    this.removeInitialMatches();
  }

  private removeInitialMatches(): void {
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        let attempts = 0;
        while (this.hasMatchAt(x, y) && attempts < 10) {
          this.grid[y][x] = Math.floor(Math.random() * this.tileTypes);
          attempts++;
        }
      }
    }
  }

  private hasMatchAt(x: number, y: number): boolean {
    const val = this.grid[y][x];
    // Check horizontal
    if (x >= 2 && this.grid[y][x - 1] === val && this.grid[y][x - 2] === val) return true;
    // Check vertical
    if (y >= 2 && this.grid[y - 1]?.[x] === val && this.grid[y - 2]?.[x] === val) return true;
    return false;
  }

  private renderGrid(): void {
    // Clear old sprites
    for (const row of this.tileSprites) {
      for (const sprite of row || []) {
        sprite?.destroy();
      }
    }

    this.tileSprites = [];
    for (let y = 0; y < this.gridHeight; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        const type = this.grid[y][x];
        if (type < 0) {
          this.tileSprites[y][x] = null;
          continue;
        }
        const px = this.gridOffsetX + x * this.tileSize + this.tileSize / 2;
        const py = this.gridOffsetY + y * this.tileSize + this.tileSize / 2;
        const sprite = this.add.sprite(px, py, `puzzle_tile_${type}`);
        sprite.setDisplaySize(this.tileSize - 4, this.tileSize - 4);
        this.tileSprites[y][x] = sprite;
      }
    }
  }

  private onTileClicked(x: number, y: number): void {
    if (!this.selectedTile) {
      this.selectedTile = { x, y };
      const sprite = this.tileSprites[y]?.[x];
      if (sprite) {
        sprite.setTint(0xffffff);
        this.tweens.add({
          targets: sprite,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 100,
        });
      }
    } else {
      const sx = this.selectedTile.x;
      const sy = this.selectedTile.y;

      // Reset selection visual
      const oldSprite = this.tileSprites[sy]?.[sx];
      if (oldSprite) {
        oldSprite.clearTint();
        this.tweens.add({
          targets: oldSprite,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
        });
      }

      // Only swap adjacent tiles
      const isAdjacent =
        (Math.abs(x - sx) === 1 && y === sy) ||
        (Math.abs(y - sy) === 1 && x === sx);

      if (isAdjacent) {
        this.swapTiles(sx, sy, x, y);
      }

      this.selectedTile = null;
    }
  }

  private swapTiles(x1: number, y1: number, x2: number, y2: number): void {
    this.processing = true;

    // Swap in grid
    const temp = this.grid[y1][x1];
    this.grid[y1][x1] = this.grid[y2][x2];
    this.grid[y2][x2] = temp;

    // Check if swap creates a match
    const matches = this.findMatches();
    if (matches.length === 0) {
      // Swap back
      this.grid[y2][x2] = this.grid[y1][x1];
      this.grid[y1][x1] = temp;
      this.processing = false;
      return;
    }

    // Animate swap
    this.renderGrid();
    this.time.delayedCall(100, () => {
      this.processMatches(matches);
    });
  }

  private findMatches(): { x: number; y: number }[] {
    const matched = new Set<string>();

    // Horizontal
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth - 2; x++) {
        const val = this.grid[y][x];
        if (val < 0) continue;
        if (this.grid[y][x + 1] === val && this.grid[y][x + 2] === val) {
          matched.add(`${x},${y}`);
          matched.add(`${x + 1},${y}`);
          matched.add(`${x + 2},${y}`);
        }
      }
    }

    // Vertical
    for (let y = 0; y < this.gridHeight - 2; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const val = this.grid[y][x];
        if (val < 0) continue;
        if (this.grid[y + 1]?.[x] === val && this.grid[y + 2]?.[x] === val) {
          matched.add(`${x},${y}`);
          matched.add(`${x},${y + 1}`);
          matched.add(`${x},${y + 2}`);
        }
      }
    }

    return Array.from(matched).map((s) => {
      const [x, y] = s.split(",").map(Number);
      return { x, y };
    });
  }

  private processMatches(matches: { x: number; y: number }[]): void {
    // Remove matched tiles
    for (const { x, y } of matches) {
      const sprite = this.tileSprites[y]?.[x];
      if (sprite) {
        this.tweens.add({
          targets: sprite,
          alpha: 0,
          scaleX: 0,
          scaleY: 0,
          duration: 200,
          onComplete: () => sprite.destroy(),
        });
      }
      this.grid[y][x] = -1;
    }

    this.matchesFound += matches.length;
    this.addScore(matches.length * (this.config.scoring?.collectiblePoints || 10));
    this.audio?.playSFX("match");

    // Drop tiles down
    this.time.delayedCall(250, () => {
      this.dropTiles();
      this.fillEmpty();
      this.renderGrid();

      // Check for cascading matches
      this.time.delayedCall(200, () => {
        const newMatches = this.findMatches();
        if (newMatches.length > 0) {
          this.processMatches(newMatches);
        } else {
          this.processing = false;
        }
      });
    });
  }

  private dropTiles(): void {
    for (let x = 0; x < this.gridWidth; x++) {
      let writeY = this.gridHeight - 1;
      for (let y = this.gridHeight - 1; y >= 0; y--) {
        if (this.grid[y][x] >= 0) {
          this.grid[writeY][x] = this.grid[y][x];
          if (writeY !== y) this.grid[y][x] = -1;
          writeY--;
        }
      }
      for (let y = writeY; y >= 0; y--) {
        this.grid[y][x] = -1;
      }
    }
  }

  private fillEmpty(): void {
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.grid[y][x] < 0) {
          this.grid[y][x] = Math.floor(Math.random() * this.tileTypes);
        }
      }
    }
  }

  update(time: number, delta: number): void {
    if (!this.roundActive) return;

    // Send score as position for multiplayer progress display
    this.multiplayer?.sendPosition(
      this.score, // Use score as "x" for progress
      0,
      0,
      0,
      "puzzle"
    );

    // Interpolate remote players (displayed as progress bars, handled by React wrapper)
    this.multiplayer?.interpolate(delta);
  }

  shutdown(): void {
    this.multiplayer?.destroy();
    this.juice?.destroy();
    this.audio?.destroy();
    if (this.boundOnRemotePlayersUpdated) {
      EventBus.off("remote-players-updated", this.boundOnRemotePlayersUpdated);
      this.boundOnRemotePlayersUpdated = null;
    }
  }
}
