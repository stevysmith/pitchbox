import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE, COLLECTIBLE_DISPLAY_SIZE } from "../lib/phaserTypes";

export class ClimberScene extends BaseScene {
  private scrollSpeed: number = 40;
  private maxHeight: number = 0;
  private cameraY: number = 0;
  private elapsedTime: number = 0;
  private respawnPenalty: number = 20;
  private dynamicPlatforms: Phaser.Physics.Arcade.StaticGroup | null = null;
  private dynamicCollectibles: Phaser.Physics.Arcade.Group | null = null;
  private highestPlatformY: number = 0;
  private lastPlatformX: number = 0;
  private maxHorizReachPx: number = 0;

  constructor() {
    super("ClimberScene");
  }

  create(): void {
    super.create();

    const worldW = this.levelData.width * TILE_SIZE * 2;
    const worldH = this.levelData.height * TILE_SIZE * 2;

    // Extend world bounds much taller for climbing
    this.physics.world.setBounds(0, -10000, worldW, worldH + 10000);
    this.cameras.main.setBounds(0, -10000, worldW, worldH + 10000);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.2);

    this.scrollSpeed = this.config.climber?.scrollSpeed || 40;
    this.cameraY = this.cameras.main.scrollY;

    // Track highest platform generated from level data
    this.highestPlatformY = this.player.y;

    // Dynamic groups for procedurally added platforms above
    this.dynamicPlatforms = this.physics.add.staticGroup();
    this.dynamicCollectibles = this.physics.add.group();

    this.physics.add.collider(this.player, this.dynamicPlatforms);
    this.physics.add.overlap(
      this.player,
      this.dynamicCollectibles,
      this.onCollectItem as any,
      undefined,
      this
    );

    // Set initial bounce force
    const bounceForce = this.config.climber?.bounceForce || 400;
    this.playerBody.setBounceY(0);

    // Calculate horizontal reach for physics-safe platform placement
    this.lastPlatformX = worldW / 2;
    const gravity = this.config.physics?.gravity || 600;
    const airTime = (2 * bounceForce) / gravity;
    const playerSpeed = this.config.physics?.playerSpeed || 200;
    this.maxHorizReachPx = playerSpeed * airTime * 0.7;
  }

  private generatePlatformsAbove(): void {
    const worldW = this.levelData.width * TILE_SIZE * 2;
    const cameraTop = this.cameras.main.scrollY;
    const generateUntil = cameraTop - 300;

    while (this.highestPlatformY > generateUntil) {
      this.highestPlatformY -= (50 + Math.random() * 40);

      const platW = 3 + Math.floor(Math.random() * 3);
      const platPixelW = platW * TILE_SIZE * 2;
      const margin = TILE_SIZE * 3;

      // Constrain X: next platform must be within horizontal jump reach of previous
      const minX = Math.max(margin, this.lastPlatformX - this.maxHorizReachPx);
      const maxX = Math.min(worldW - platPixelW - margin, this.lastPlatformX + this.maxHorizReachPx);
      const x = minX + Math.random() * Math.max(0, maxX - minX);

      for (let px = 0; px < platW; px++) {
        const sprite = this.dynamicPlatforms!.create(
          x + px * TILE_SIZE * 2 + TILE_SIZE,
          this.highestPlatformY + TILE_SIZE,
          "platform_tile"
        ) as Phaser.Physics.Arcade.Sprite;
        sprite.setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2);
        sprite.refreshBody();
      }

      // Track center of this platform for next constraint
      this.lastPlatformX = x + platPixelW / 2;

      // Collectible on some platforms
      if (Math.random() < 0.35) {
        const col = this.dynamicCollectibles!.create(
          x + (platPixelW / 2),
          this.highestPlatformY - TILE_SIZE,
          "collectible"
        ) as Phaser.Physics.Arcade.Sprite;
        col.setDisplaySize(COLLECTIBLE_DISPLAY_SIZE, COLLECTIBLE_DISPLAY_SIZE);
        (col.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        this.tweens.add({
          targets: col,
          y: col.y - 6,
          duration: 800,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!this.roundActive) return;

    this.elapsedTime += delta / 1000;

    // Auto-scroll camera upward (increasing speed)
    const currentScrollSpeed = this.scrollSpeed + this.elapsedTime * 2;
    this.cameras.main.scrollY -= currentScrollSpeed * (delta / 1000);

    // Generate more platforms as camera scrolls up
    this.generatePlatformsAbove();

    // Player movement
    const speed = this.config.physics?.playerSpeed || 200;
    let vx = 0;
    if (this.isLeftDown()) vx = -speed;
    if (this.isRightDown()) vx = speed;
    this.playerBody.setVelocityX(vx);

    // Jump with coyote time + jump buffering
    const bounceForce = this.config.climber?.bounceForce || 400;
    this.updatePlatformerPhysics(bounceForce);

    // Track max height (lower Y = higher)
    const currentHeight = Math.max(0, Math.floor((this.levelData.height * TILE_SIZE * 2 - this.player.y) / 10));
    if (currentHeight > this.maxHeight) {
      this.maxHeight = currentHeight;
      this.score = this.maxHeight;
      this.scoreText.setText(`Score: ${this.score}`);
    }

    // Fall below camera = respawn
    const cameraBottom = this.cameras.main.scrollY + this.cameras.main.height;
    if (this.player.y > cameraBottom + 50) {
      this.respawn();
    }

    // Flip sprite
    if (vx < 0) this.player.setFlipX(true);
    if (vx > 0) this.player.setFlipX(false);
  }

  private respawn(): void {
    // Respawn on camera center
    const cameraCenter = this.cameras.main.scrollY + this.cameras.main.height / 2;
    const worldW = this.levelData.width * TILE_SIZE * 2;
    this.player.setPosition(worldW / 2, cameraCenter);
    this.playerBody.setVelocity(0, 0);

    // Penalty
    this.addScore(-this.respawnPenalty);
    this.cameras.main.flash(300, 255, 100, 100, false);
  }

  shutdown(): void {
    super.shutdown();
    this.dynamicPlatforms?.destroy(true);
    this.dynamicCollectibles?.destroy(true);
  }
}
