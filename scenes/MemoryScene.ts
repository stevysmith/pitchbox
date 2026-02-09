import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE } from "../lib/phaserTypes";
import { EventBus } from "../lib/EventBus";
import { createPuzzleTile } from "../lib/SpriteFactory";
import { JuiceManager } from "../lib/JuiceManager";
import { AudioManager } from "../lib/AudioManager";

const MEMORY_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];

export class MemoryScene extends BaseScene {
  private gridSize: number = 4;
  private tileSize: number = 64;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private sequence: number[] = [];
  private inputIndex: number = 0;
  private phase: "watching" | "input" | "success" | "fail" = "watching";
  private currentLevel: number = 0;
  private tileSprites: Phaser.GameObjects.Sprite[] = [];
  private phaseText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private flashDuration: number = 500;
  private startLength: number = 3;

  constructor() {
    super("MemoryScene");
  }

  preload(): void {
    super.preload();
    for (let i = 0; i < MEMORY_COLORS.length; i++) {
      createPuzzleTile(this, i, MEMORY_COLORS[i]);
    }
  }

  create(): void {
    // Don't call super.create() — memory doesn't use tilemap/physics player
    // Initialize juice & audio manually
    JuiceManager.ensureWhiteTexture(this);
    this.juice = new JuiceManager(this);
    this.audio = new AudioManager();
    this.audio.resume();

    this.roundActive = true;
    this.score = 0;

    this.gridSize = this.config.memory?.gridSize || 4;
    this.flashDuration = this.config.memory?.flashDuration || 500;
    this.startLength = this.config.memory?.startLength || 3;

    // Calculate grid layout
    const cam = this.cameras.main;
    this.tileSize = Math.min(
      Math.floor((cam.width - 60) / this.gridSize),
      Math.floor((cam.height - 140) / this.gridSize),
      80
    );
    this.gridOffsetX = (cam.width - this.gridSize * this.tileSize) / 2;
    this.gridOffsetY = 80;

    // Background
    this.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height,
      Phaser.Display.Color.HexStringToColor(this.config.colors?.sky || "#1a1a2e").color
    );

    // Create grid tiles
    const totalTiles = this.gridSize * this.gridSize;
    this.tileSprites = [];
    for (let i = 0; i < totalTiles; i++) {
      const gx = i % this.gridSize;
      const gy = Math.floor(i / this.gridSize);
      const px = this.gridOffsetX + gx * this.tileSize + this.tileSize / 2;
      const py = this.gridOffsetY + gy * this.tileSize + this.tileSize / 2;

      // Use a dim base tile
      const sprite = this.add.sprite(px, py, `puzzle_tile_0`);
      sprite.setDisplaySize(this.tileSize - 6, this.tileSize - 6);
      sprite.setAlpha(0.3);
      sprite.setInteractive();
      sprite.setData("index", i);

      sprite.on("pointerdown", () => this.onTileClicked(i));

      this.tileSprites.push(sprite);
    }

    // Phase label
    this.phaseText = this.add.text(cam.width / 2, this.gridOffsetY + this.gridSize * this.tileSize + 20, "WATCH!", {
      fontSize: "18px",
      fontFamily: "monospace",
      color: "#ffd700",
      backgroundColor: "#000000aa",
      padding: { x: 10, y: 5 },
    });
    this.phaseText.setOrigin(0.5);

    // Level label
    this.levelText = this.add.text(cam.width / 2, 20, "Level 1", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#ffffff",
      backgroundColor: "#000000aa",
      padding: { x: 8, y: 4 },
    });
    this.levelText.setOrigin(0.5);

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
      // Start first level after countdown
      this.currentLevel = 0;
      this.startNewLevel();
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

  private startNewLevel(): void {
    this.currentLevel++;
    this.levelText.setText(`Level ${this.currentLevel}`);

    // Generate sequence
    const seqLength = this.startLength + this.currentLevel - 1;
    const totalTiles = this.gridSize * this.gridSize;

    // Add one tile to existing sequence (or generate new if first)
    if (this.sequence.length === 0) {
      this.sequence = [];
      for (let i = 0; i < seqLength; i++) {
        this.sequence.push(Math.floor(Math.random() * totalTiles));
      }
    } else {
      this.sequence.push(Math.floor(Math.random() * totalTiles));
    }

    this.inputIndex = 0;
    this.phase = "watching";
    this.phaseText.setText("WATCH!");
    this.phaseText.setColor("#ffd700");

    // Flash the sequence
    this.flashSequence();
  }

  private flashSequence(): void {
    // Reset all tiles to dim
    for (const sprite of this.tileSprites) {
      sprite.setAlpha(0.3);
      sprite.setTexture(`puzzle_tile_0`);
    }

    // Flash each tile in sequence with delay
    const speedMultiplier = Math.max(0.5, 1 - this.currentLevel * 0.05);
    const delay = this.flashDuration * speedMultiplier;

    this.sequence.forEach((tileIndex, seqIdx) => {
      this.time.delayedCall(delay * (seqIdx + 1), () => {
        if (!this.roundActive) return;
        // Highlight tile
        const colorIdx = (tileIndex % MEMORY_COLORS.length);
        const sprite = this.tileSprites[tileIndex];
        if (sprite) {
          sprite.setTexture(`puzzle_tile_${colorIdx}`);
          sprite.setAlpha(1);

          // Dim after short period
          this.time.delayedCall(delay * 0.7, () => {
            sprite.setAlpha(0.3);
            sprite.setTexture(`puzzle_tile_0`);
          });
        }
      });
    });

    // After full sequence shown, switch to input phase
    this.time.delayedCall(delay * (this.sequence.length + 1.5), () => {
      if (!this.roundActive) return;
      this.phase = "input";
      this.phaseText.setText("YOUR TURN!");
      this.phaseText.setColor("#2ecc71");
    });
  }

  private onTileClicked(index: number): void {
    if (this.phase !== "input" || !this.roundActive) return;

    const expected = this.sequence[this.inputIndex];
    const sprite = this.tileSprites[index];

    if (index === expected) {
      // Correct!
      const colorIdx = (index % MEMORY_COLORS.length);
      if (sprite) {
        sprite.setTexture(`puzzle_tile_${colorIdx}`);
        sprite.setAlpha(1);
        this.time.delayedCall(200, () => {
          sprite.setAlpha(0.3);
          sprite.setTexture(`puzzle_tile_0`);
        });
      }

      this.inputIndex++;

      if (this.inputIndex >= this.sequence.length) {
        // Completed the sequence!
        this.phase = "success";
        this.phaseText.setText("CORRECT!");
        this.phaseText.setColor("#2ecc71");
        this.audio?.playSFX("correct");

        // Score: points per sequence length, bonus for speed
        const points = this.sequence.length * (this.config.scoring?.collectiblePoints || 10);
        this.addScore(points);

        // Brief celebration, then next level
        this.cameras.main.flash(200, 46, 204, 113, false);
        this.time.delayedCall(800, () => {
          if (this.roundActive) {
            this.startNewLevel();
          }
        });
      }
    } else {
      // Wrong!
      this.phase = "fail";
      this.phaseText.setText("WRONG!");
      this.phaseText.setColor("#e74c3c");
      this.audio?.playSFX("wrong");

      if (sprite) {
        sprite.setTint(0xff0000);
        this.time.delayedCall(300, () => sprite.clearTint());
      }

      this.cameras.main.flash(200, 255, 0, 0, false);
      this.cameras.main.shake(200, 0.01);

      // Reset sequence and restart level (keep sequence, just replay)
      this.time.delayedCall(800, () => {
        if (this.roundActive) {
          this.inputIndex = 0;
          this.phase = "watching";
          this.phaseText.setText("WATCH AGAIN!");
          this.phaseText.setColor("#ffd700");
          this.flashSequence();
        }
      });
    }
  }

  update(time: number, delta: number): void {
    if (!this.roundActive) return;

    // Send score as position for multiplayer progress
    this.multiplayer?.sendPosition(
      this.score,
      this.currentLevel,
      0,
      0,
      "memory"
    );

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
