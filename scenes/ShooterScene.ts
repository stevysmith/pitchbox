import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE, HAZARD_DISPLAY_SIZE } from "../lib/phaserTypes";
import { createTargetSprite, createCrosshairSprite } from "../lib/SpriteFactory";
import { ObjectPool } from "../lib/ObjectPool";

export class ShooterScene extends BaseScene {
  private targetPool: ObjectPool | null = null;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private crosshair: Phaser.GameObjects.Sprite | null = null;
  private shots: number = 0;
  private hits: number = 0;

  constructor() {
    super("ShooterScene");
  }

  create(): void {
    // Generate extra sprites
    // If AI collectible sprite exists, reuse it as the target texture
    if (this.config.spriteImages?.collectible && this.textures.exists("collectible")) {
      // AI collectible already loaded in preload — alias it as "target"
      const source = this.textures.get("collectible").getSourceImage();
      this.textures.addImage("target", source as HTMLImageElement);
    } else {
      createTargetSprite(this, this.config.colors?.collectible || "#ff6600");
    }
    createCrosshairSprite(this);

    super.create();

    // No player movement in shooter -- hide player sprite
    this.player.setVisible(false);
    this.playerBody.setAllowGravity(false);
    this.playerBody.setImmovable(true);

    // World setup
    const worldW = this.cameras.main.width;
    const worldH = this.cameras.main.height;

    // Target pool
    this.targetPool = new ObjectPool(this, "target", HAZARD_DISPLAY_SIZE, 10);

    // Crosshair follows mouse/touch
    this.crosshair = this.add.sprite(worldW / 2, worldH / 2, "crosshair");
    this.crosshair.setDisplaySize(32, 32);
    this.crosshair.setDepth(900);
    this.crosshair.setScrollFactor(0);

    // Hide system cursor
    this.input.setDefaultCursor("none");

    // Click/tap to shoot
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.shoot(pointer.x, pointer.y);
    });

    // Spawn targets periodically
    const interval = this.config.shooter?.spawnInterval || 1200;
    this.spawnTimer = this.time.addEvent({
      delay: Math.max(400, interval - this.config.difficulty * 150),
      callback: this.spawnTarget,
      callbackScope: this,
      loop: true,
    });

    // Spawn initial targets
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 300, () => this.spawnTarget());
    }

    // Accuracy display
    this.add.text(10, 30, "", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#aaaaaa",
    }).setScrollFactor(0).setDepth(999);
  }

  private spawnTarget(): void {
    if (!this.roundActive) return;

    const cam = this.cameras.main;
    const margin = 60;
    const x = margin + Math.random() * (cam.width - margin * 2);
    const y = margin + Math.random() * (cam.height - margin * 2 - 40);

    const target = this.targetPool!.spawn(x, y);
    (target.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    target.setScrollFactor(0);

    // Move target
    const speed = (this.config.shooter?.targetSpeed || 60) + this.config.difficulty * 15;
    const angle = Math.random() * Math.PI * 2;
    (target.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    (target.body as Phaser.Physics.Arcade.Body).setBounce(1, 1);
    target.setCollideWorldBounds(true);

    // Pop-in animation
    target.setScale(0);
    this.tweens.add({
      targets: target,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: "Back.easeOut",
    });

    // Auto-despawn after time
    this.time.delayedCall(6000, () => {
      if (target.active) {
        this.tweens.add({
          targets: target,
          alpha: 0,
          duration: 200,
          onComplete: () => this.targetPool!.despawn(target),
        });
      }
    });
  }

  private shoot(x: number, y: number): void {
    if (!this.roundActive) return;
    this.shots++;

    // Audio: shoot SFX
    this.audio?.playSFX("shoot");

    // Flash effect at click position
    const flash = this.add.circle(x, y, 8, 0xffffff, 0.8);
    flash.setScrollFactor(0);
    flash.setDepth(800);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 150,
      onComplete: () => flash.destroy(),
    });

    // Check hit on targets
    let hitAny = false;
    const targetChildren = this.targetPool!.getGroup().getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const target of targetChildren) {
      if (!target.active) continue;
      const dx = target.x - x;
      const dy = target.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = HAZARD_DISPLAY_SIZE / 2;

      if (dist < hitRadius) {
        hitAny = true;
        this.hits++;
        const pts = this.config.scoring?.collectiblePoints || 25;
        this.addScore(pts);
        this.audio?.playSFX("collect");

        // Destroy with particles
        const particles = this.add.particles(target.x, target.y, "target", {
          speed: { min: 80, max: 150 },
          scale: { start: 0.4, end: 0 },
          lifespan: 300,
          quantity: 8,
        });
        particles.setScrollFactor(0);
        this.time.delayedCall(400, () => particles.destroy());

        this.targetPool!.despawn(target);
        break; // One hit per click
      }
    }

    if (!hitAny) {
      // Miss flash
      const miss = this.add.text(x, y - 10, "MISS", {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#ff4444",
      });
      miss.setOrigin(0.5);
      miss.setScrollFactor(0);
      miss.setDepth(800);
      this.tweens.add({
        targets: miss,
        y: miss.y - 20,
        alpha: 0,
        duration: 500,
        onComplete: () => miss.destroy(),
      });
    }
  }

  update(time: number, delta: number): void {
    // Don't call super.update for player movement (no player sprite to move)
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

    // Send crosshair position as player position
    const pointer = this.input.activePointer;
    if (this.crosshair) {
      this.crosshair.x = pointer.x;
      this.crosshair.y = pointer.y;
    }

    this.multiplayer.sendPosition(
      pointer.x,
      pointer.y,
      0,
      0,
      "aim"
    );
  }

  shutdown(): void {
    super.shutdown();
    this.spawnTimer?.destroy();
    this.targetPool?.destroy();
    this.input.setDefaultCursor("default");
  }
}
