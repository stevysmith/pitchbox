import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE, PLAYER_COLORS, PLAYER_DISPLAY_SIZE } from "../lib/phaserTypes";
import { EventBus } from "../lib/EventBus";
import { JuiceManager } from "../lib/JuiceManager";
import { AudioManager } from "../lib/AudioManager";

export class SumoScene extends BaseScene {
  private platformRadius: number = 200;
  private initialRadius: number = 200;
  private shrinkRate: number = 5;
  private knockbackForce: number = 300;
  private dashCooldown: number = 2000;
  private lastDashTime: number = 0;
  private eliminated: boolean = false;
  private survivalTime: number = 0;
  private platformGraphics!: Phaser.GameObjects.Graphics;
  private shrinkTimer: Phaser.Time.TimerEvent | null = null;
  private centerX: number = 0;
  private centerY: number = 0;
  private dashIndicator!: Phaser.GameObjects.Arc;

  constructor() {
    super("SumoScene");
  }

  create(): void {
    // Don't call super.create() — sumo draws its own arena
    // Initialize juice & audio manually
    JuiceManager.ensureWhiteTexture(this);
    this.juice = new JuiceManager(this);
    this.audio = new AudioManager();
    this.audio.resume();

    this.roundActive = true;
    this.score = 0;
    this.eliminated = false;
    this.survivalTime = 0;
    this.lastDashTime = 0;

    this.initialRadius = this.config.sumo?.platformRadius || 200;
    this.platformRadius = this.initialRadius;
    this.shrinkRate = this.config.sumo?.shrinkRate || 5;
    this.knockbackForce = this.config.sumo?.knockbackForce || 300;
    this.dashCooldown = this.config.sumo?.dashCooldown || 2000;

    const cam = this.cameras.main;
    this.centerX = cam.width / 2;
    this.centerY = cam.height / 2;

    // Background
    this.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height,
      Phaser.Display.Color.HexStringToColor(this.config.colors?.sky || "#1a1a2e").color
    );

    // Platform (circular)
    this.platformGraphics = this.add.graphics();
    this.drawPlatform();

    // Create player with physics
    const playerTexture = this._useAIPlayerSprite ? "player_template" : `player_${this.playerId}`;
    this.player = this.physics.add.sprite(
      this.centerX + (Math.random() - 0.5) * 80,
      this.centerY + (Math.random() - 0.5) * 80,
      playerTexture
    );
    this.player.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);
    if (this._useAIPlayerSprite) {
      this.player.setTint(Phaser.Display.Color.HexStringToColor(this.playerColor).color);
    }
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setAllowGravity(false);
    this.playerBody.setDrag(200, 200);
    this.playerBody.setMaxVelocity(300, 300);

    // Name tag
    const nameTagY = -(PLAYER_DISPLAY_SIZE / 2 + 6);
    const nameTag = this.add.text(0, nameTagY, this.playerName, {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 3, y: 1 },
    });
    nameTag.setOrigin(0.5);
    this.events.on("update", () => {
      if (!this.eliminated) {
        nameTag.setPosition(this.player.x, this.player.y + nameTagY);
        nameTag.setVisible(true);
      } else {
        nameTag.setVisible(false);
      }
    });

    // Input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    const { MobileControls } = require("../lib/MobileControls");
    this.mobileControls = new MobileControls(this, "DASH");

    // Dash cooldown indicator
    this.dashIndicator = this.add.circle(cam.width - 40, cam.height - 40, 15, 0x7c3aed, 0.8);
    this.dashIndicator.setScrollFactor(0);
    this.dashIndicator.setDepth(998);

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

    // Shrink platform every 5 seconds
    this.shrinkTimer = this.time.addEvent({
      delay: 5000,
      callback: this.shrinkPlatform,
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

  private drawPlatform(): void {
    this.platformGraphics.clear();

    // Outer ring (edge warning)
    this.platformGraphics.fillStyle(
      Phaser.Display.Color.HexStringToColor(this.config.colors?.hazard || "#ff4444").color,
      0.3
    );
    this.platformGraphics.fillCircle(this.centerX, this.centerY, this.platformRadius + 10);

    // Main platform
    this.platformGraphics.fillStyle(
      Phaser.Display.Color.HexStringToColor(this.config.colors?.ground || "#4a7c59").color,
      0.8
    );
    this.platformGraphics.fillCircle(this.centerX, this.centerY, this.platformRadius);

    // Center marking
    this.platformGraphics.fillStyle(
      Phaser.Display.Color.HexStringToColor(this.config.colors?.platform || "#8b6914").color,
      0.4
    );
    this.platformGraphics.fillCircle(this.centerX, this.centerY, this.platformRadius * 0.3);
  }

  private shrinkPlatform(): void {
    if (!this.roundActive) return;
    this.platformRadius = Math.max(60, this.platformRadius - this.shrinkRate);
    this.drawPlatform();

    // Camera shake on shrink
    this.cameras.main.shake(200, 0.005);
  }

  private dash(): void {
    if (this.eliminated || !this.roundActive) return;

    const now = this.time.now;
    if (now - this.lastDashTime < this.dashCooldown) return;
    this.lastDashTime = now;

    // Dash in the direction the player is moving (or facing)
    let dx = 0;
    let dy = 0;
    if (this.isLeftDown()) dx = -1;
    if (this.isRightDown()) dx = 1;
    if (this.isUpDown()) dy = -1;
    if (this.isDownKeyDown()) dy = 1;

    // Default: dash right if no direction held
    if (dx === 0 && dy === 0) {
      dx = this.player.flipX ? -1 : 1;
    }

    // Normalize
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    const dashForce = this.knockbackForce * 1.5;
    this.playerBody.setVelocity(dx * dashForce, dy * dashForce);

    // Audio: dash SFX
    this.audio?.playSFX("dash");

    // Visual feedback
    this.player.setAlpha(0.6);
    this.time.delayedCall(200, () => {
      this.player.setAlpha(1);
    });

    // Flash dash indicator
    this.dashIndicator.setFillStyle(0x555555, 0.5);
    this.time.delayedCall(this.dashCooldown, () => {
      if (this.dashIndicator) {
        this.dashIndicator.setFillStyle(0x7c3aed, 0.8);
      }
    });
  }

  private checkBoundary(): void {
    const dx = this.player.x - this.centerX;
    const dy = this.player.y - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.platformRadius) {
      // Push player outward (falling off effect)
      const nx = dx / dist;
      const ny = dy / dist;
      const pushForce = 50 + (dist - this.platformRadius) * 2;
      this.playerBody.setVelocity(
        this.playerBody.velocity.x + nx * pushForce,
        this.playerBody.velocity.y + ny * pushForce
      );

      // If way outside, eliminate
      if (dist > this.platformRadius + 80) {
        this.eliminate();
      }
    }
  }

  private eliminate(): void {
    if (this.eliminated) return;
    this.eliminated = true;

    this.player.setVisible(false);
    this.playerBody.setVelocity(0, 0);

    this.cameras.main.flash(300, 255, 0, 0, false);

    // Show elimination text
    const elimText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY - 60,
      "ELIMINATED!",
      {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#ff4444",
        backgroundColor: "#000000cc",
        padding: { x: 15, y: 8 },
      }
    );
    elimText.setOrigin(0.5);
    elimText.setDepth(1000);
  }

  private handleRemotePlayerCollision(): void {
    if (this.eliminated) return;

    // Check collision with remote players
    for (const [id, container] of this.remoteSpriteMap) {
      const dx = this.player.x - container.x;
      const dy = this.player.y - container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PLAYER_DISPLAY_SIZE * 0.8) {
        // Bump! Apply knockback to local player
        const nx = dx / Math.max(1, dist);
        const ny = dy / Math.max(1, dist);
        const force = this.knockbackForce * 0.8;
        this.playerBody.setVelocity(
          this.playerBody.velocity.x + nx * force,
          this.playerBody.velocity.y + ny * force
        );

        // Visual feedback
        this.cameras.main.shake(100, 0.008);
      }
    }
  }

  update(time: number, delta: number): void {
    if (!this.roundActive) return;

    // Interpolate remote players
    const remotes = this.multiplayer.interpolate(delta);
    for (const rp of remotes) {
      const container = this.remoteSpriteMap.get(rp.playerId);
      if (container) {
        container.x = rp.x;
        container.y = rp.y;
      }
    }

    if (!this.eliminated) {
      // Movement
      const speed = this.config.physics?.playerSpeed || 180;
      let vx = 0;
      let vy = 0;
      if (this.isLeftDown()) vx = -speed;
      if (this.isRightDown()) vx = speed;
      if (this.isUpDown()) vy = -speed;
      if (this.isDownKeyDown()) vy = speed;

      // Normalize diagonal
      if (vx !== 0 && vy !== 0) {
        vx *= 0.707;
        vy *= 0.707;
      }

      // Apply as acceleration rather than direct velocity for smoother sumo feel
      this.playerBody.setAcceleration(vx * 3, vy * 3);

      // Dash
      if (this.isActionDown()) {
        this.dash();
      }

      // Check boundary
      this.checkBoundary();

      // Check collisions with remote players
      this.handleRemotePlayerCollision();

      // Survival scoring
      this.survivalTime += delta / 1000;
      this.score = Math.floor(this.survivalTime * 3);
      this.scoreText.setText(`Score: ${this.score}`);

      // Flip sprite
      if (vx < 0) this.player.setFlipX(true);
      if (vx > 0) this.player.setFlipX(false);
    }

    // Send position
    this.multiplayer.sendPosition(
      this.eliminated ? -1000 : this.player.x,
      this.eliminated ? -1000 : this.player.y,
      this.eliminated ? 0 : this.playerBody.velocity.x,
      this.eliminated ? 0 : this.playerBody.velocity.y,
      this.eliminated ? "eliminated" : "sumo"
    );
  }

  protected endRound(): void {
    if (!this.roundActive) return;
    this.roundActive = false;

    // Last-standing bonus: if not eliminated, add bonus
    if (!this.eliminated) {
      this.score += 100;
    }

    // Stop BGM
    this.audio?.stopBGM();

    // Camera zoom
    this.cameras.main.zoomTo(1.3, 600, "Quad.easeOut");

    // Confetti burst
    this.juice?.confettiBurst(
      this.cameras.main.centerX,
      this.cameras.main.centerY
    );

    // Show final score with scale-in animation
    const finalText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      `SCORE: ${this.score}`,
      {
        fontSize: "32px",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontStyle: "bold",
        color: "#ffd700",
        stroke: "#000000",
        strokeThickness: 4,
        shadow: { offsetX: 2, offsetY: 2, color: "#000000", blur: 8, fill: true, stroke: true },
        padding: { x: 20, y: 12 },
      }
    );
    finalText.setOrigin(0.5);
    finalText.setDepth(2000);
    finalText.setScale(0);

    this.tweens.add({
      targets: finalText,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: "Back.easeOut",
    });

    // Fade out and emit score after delay
    this.time.delayedCall(1200, () => {
      this.cameras.main.fadeOut(400);
    });

    this.time.delayedCall(2000, () => {
      if (this.scene.isActive("UIScene")) {
        this.scene.stop("UIScene");
      }
      EventBus.emit("round-complete", {
        score: this.score,
        playerId: this.playerId,
        round: this.round,
      });
    });
  }

  shutdown(): void {
    this.multiplayer?.destroy();
    this.mobileControls?.destroy();
    this.shrinkTimer?.destroy();
    this.juice?.destroy();
    this.audio?.destroy();
    if (this.boundOnRemotePlayersUpdated) {
      EventBus.off("remote-players-updated", this.boundOnRemotePlayersUpdated);
      this.boundOnRemotePlayersUpdated = null;
    }
    this.remoteSpriteMap.clear();
  }
}
