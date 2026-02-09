import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE, COLLECTIBLE_DISPLAY_SIZE, HAZARD_DISPLAY_SIZE } from "../lib/phaserTypes";

export class ArenaScene extends BaseScene {
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private movingHazards: Phaser.Physics.Arcade.Sprite[] = [];

  constructor() {
    super("ArenaScene");
  }

  create(): void {
    super.create();

    // Top-down: disable gravity, add drag for momentum feel
    this.playerBody.setAllowGravity(false);
    this.playerBody.setDrag(480, 480);
    this.playerBody.setMaxVelocity(240, 240);

    const worldW = this.levelData.width * TILE_SIZE * 2;
    const worldH = this.levelData.height * TILE_SIZE * 2;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    // Spawn items on timer
    const spawnRate = this.config.arena?.itemSpawnRate || 3000;
    this.spawnTimer = this.time.addEvent({
      delay: spawnRate,
      callback: this.spawnCollectible,
      callbackScope: this,
      loop: true,
    });

    // Create moving hazards
    const numHazards = Math.min(this.config.difficulty * 2, 8);
    for (let i = 0; i < numHazards; i++) {
      this.createMovingHazard(worldW, worldH);
    }
  }

  private spawnCollectible(): void {
    if (!this.roundActive) return;
    const worldW = this.levelData.width * TILE_SIZE * 2;
    const worldH = this.levelData.height * TILE_SIZE * 2;
    const margin = TILE_SIZE * 4;
    const x = margin + Math.random() * (worldW - margin * 2);
    const y = margin + Math.random() * (worldH - margin * 2);

    const item = this.collectibleGroup.create(x, y, "collectible") as Phaser.Physics.Arcade.Sprite;
    item.setDisplaySize(COLLECTIBLE_DISPLAY_SIZE, COLLECTIBLE_DISPLAY_SIZE);
    if (item.body) {
      (item.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }
    this.tweens.add({
      targets: item,
      y: item.y - 6,
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private createMovingHazard(worldW: number, worldH: number): void {
    const margin = TILE_SIZE * 4;
    const x = margin + Math.random() * (worldW - margin * 2);
    const y = margin + Math.random() * (worldH - margin * 2);

    const hazard = this.physics.add.sprite(x, y, "hazard");
    hazard.setDisplaySize(HAZARD_DISPLAY_SIZE, HAZARD_DISPLAY_SIZE);
    (hazard.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    hazard.setCollideWorldBounds(true);
    (hazard.body as Phaser.Physics.Arcade.Body).setBounce(1, 1);

    const speed = 40 + this.config.difficulty * 20;
    const angle = Math.random() * Math.PI * 2;
    (hazard.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );

    this.movingHazards.push(hazard);

    this.physics.add.overlap(
      this.player,
      hazard,
      () => {
        this.cameras.main.flash(200, 255, 0, 0, false);
        this.addScore(-5);
        const dx = this.player.x - hazard.x;
        const dy = this.player.y - hazard.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        this.playerBody.setVelocity((dx / dist) * 200, (dy / dist) * 200);
      },
      undefined,
      this
    );
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!this.roundActive) return;

    const speed = this.config.physics?.playerSpeed || 160;
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

    // Acceleration-based movement for snappy momentum feel
    this.playerBody.setAcceleration(vx * 5, vy * 5);
  }

  shutdown(): void {
    super.shutdown();
    this.spawnTimer?.destroy();
    this.movingHazards = [];
  }
}
