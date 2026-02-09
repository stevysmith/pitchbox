import * as Phaser from "phaser";

/**
 * JuiceManager — reusable game-feel effects for all scenes.
 * Provides floating text, particle bursts, screen shake, hit freeze,
 * squash/stretch, and HUD animations. All code-only, no asset files.
 */
export class JuiceManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Ensure a generic white pixel texture exists for particles. */
  static ensureWhiteTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists("__WHITE")) return;
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 4, 4);
    scene.textures.addCanvas("__WHITE", canvas);
  }

  // ── Floating Text ──────────────────────────────────────────────

  /** "+10" / "-5" that rises and fades out. */
  floatingText(
    x: number,
    y: number,
    text: string,
    color: string = "#ffd700"
  ): void {
    const t = this.scene.add.text(x, y, text, {
      fontSize: "16px",
      fontFamily: "monospace",
      fontStyle: "bold",
      color,
      stroke: "#000000",
      strokeThickness: 3,
    });
    t.setOrigin(0.5);
    t.setDepth(1500);

    this.scene.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  // ── Squash & Stretch ───────────────────────────────────────────

  /** Procedural deformation for impacts. */
  squashStretch(sprite: Phaser.GameObjects.Sprite, intensity: number = 1): void {
    this.scene.tweens.add({
      targets: sprite,
      scaleX: sprite.scaleX * (1 + 0.3 * intensity),
      scaleY: sprite.scaleY * (1 - 0.2 * intensity),
      duration: 80,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  // ── Landing Impact ─────────────────────────────────────────────

  /** Squash + dust particles at feet on landing. */
  landingImpact(sprite: Phaser.GameObjects.Sprite): void {
    // Squash
    const baseScaleX = sprite.scaleX;
    const baseScaleY = sprite.scaleY;
    this.scene.tweens.add({
      targets: sprite,
      scaleX: baseScaleX * 1.2,
      scaleY: baseScaleY * 0.8,
      duration: 60,
      yoyo: true,
      ease: "Quad.easeOut",
    });

    // Dust particles
    if (this.scene.textures.exists("__WHITE")) {
      const footY = sprite.y + sprite.displayHeight / 2;
      const particles = this.scene.add.particles(sprite.x, footY, "__WHITE", {
        speed: { min: 20, max: 60 },
        angle: { min: 160, max: 200 },
        scale: { start: 0.6, end: 0 },
        lifespan: 250,
        quantity: 4,
        tint: 0x888888,
      });
      particles.setDepth(sprite.depth - 1);
      this.scene.time.delayedCall(300, () => particles.destroy());
    }
  }

  // ── Screen Shake ───────────────────────────────────────────────

  /** Viewport-scaled screen shake. */
  shake(duration: number = 200, intensity: number = 0.01): void {
    // Scale intensity by viewport size so shake feels consistent
    const scale = Math.min(1, 540 / this.scene.cameras.main.height);
    this.scene.cameras.main.shake(duration, intensity * scale);
  }

  // ── Hit Freeze ─────────────────────────────────────────────────

  /** Brief time dilation on big hits. */
  hitFreeze(ms: number = 60): void {
    this.scene.time.timeScale = 0.1;
    this.scene.physics.world.timeScale = 10; // inverse
    this.scene.time.delayedCall(ms, () => {
      if (this.scene && this.scene.sys && this.scene.sys.isActive()) {
        this.scene.time.timeScale = 1;
        this.scene.physics.world.timeScale = 1;
      }
    });
  }

  // ── Collect Burst ──────────────────────────────────────────────

  /** 8-particle burst + floating score at collection point. */
  collectBurst(
    x: number,
    y: number,
    points: number,
    textureKey: string = "__WHITE"
  ): void {
    const key = this.scene.textures.exists(textureKey) ? textureKey : "__WHITE";

    const particles = this.scene.add.particles(x, y, key, {
      speed: { min: 60, max: 140 },
      scale: { start: 0.5, end: 0 },
      lifespan: 350,
      quantity: 8,
      tint: [0xffd700, 0xffee88, 0xffffff],
    });
    particles.setDepth(1400);
    this.scene.time.delayedCall(400, () => particles.destroy());

    // Floating score
    const sign = points >= 0 ? "+" : "";
    const color = points >= 0 ? "#ffd700" : "#ff4444";
    this.floatingText(x, y - 10, `${sign}${points}`, color);
  }

  // ── Damage Flash ───────────────────────────────────────────────

  /** Shake + flash + alpha blink + floating text on damage. */
  damageFlash(
    sprite: Phaser.GameObjects.Sprite,
    penalty: number
  ): void {
    // Screen shake
    this.shake(200, 0.012);

    // Red flash
    this.scene.cameras.main.flash(150, 255, 0, 0, false);

    // Alpha blink (3 blinks over 400ms)
    let blinkCount = 0;
    const blinkTimer = this.scene.time.addEvent({
      delay: 70,
      callback: () => {
        blinkCount++;
        sprite.setAlpha(blinkCount % 2 === 0 ? 1 : 0.3);
        if (blinkCount >= 6) {
          blinkTimer.destroy();
          sprite.setAlpha(1);
        }
      },
      loop: true,
    });

    // Floating penalty text
    this.floatingText(
      sprite.x,
      sprite.y - sprite.displayHeight / 2,
      `${penalty}`,
      "#ff4444"
    );
  }

  // ── Score Pop ──────────────────────────────────────────────────

  /** Bounce animation on score text. */
  scorePop(textObj: Phaser.GameObjects.Text): void {
    this.scene.tweens.add({
      targets: textObj,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 80,
      yoyo: true,
      ease: "Back.easeOut",
    });
  }

  // ── Timer Urgency ──────────────────────────────────────────────

  /** Pulse animation for last 5 seconds of timer. */
  timerUrgency(textObj: Phaser.GameObjects.Text): void {
    this.scene.tweens.add({
      targets: textObj,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 150,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
    textObj.setColor("#ff4444");
  }

  // ── Confetti Burst (used by endRound) ──────────────────────────

  /** Multi-color confetti burst for end-of-round celebration. */
  confettiBurst(x: number, y: number): void {
    if (!this.scene.textures.exists("__WHITE")) return;

    const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff];

    for (const tint of colors) {
      const particles = this.scene.add.particles(x, y, "__WHITE", {
        speed: { min: 100, max: 300 },
        angle: { min: 220, max: 320 },
        scale: { start: 0.8, end: 0.2 },
        lifespan: { min: 800, max: 1500 },
        quantity: 6,
        gravityY: 200,
        tint,
      });
      particles.setDepth(2000);
      this.scene.time.delayedCall(1600, () => particles.destroy());
    }
  }

  destroy(): void {
    // Nothing to clean up — all tweens/particles belong to the scene
  }
}
