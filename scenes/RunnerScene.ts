import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE, PLAYER_DISPLAY_SIZE } from "../lib/phaserTypes";

export class RunnerScene extends BaseScene {
  private scrollSpeed: number = 0;
  private distanceScore: number = 0;
  private isDucking: boolean = false;
  private baseCollectScore: number = 0;

  constructor() {
    super("RunnerScene");
  }

  create(): void {
    super.create();

    this.scrollSpeed = this.config.runner?.scrollSpeed || (100 + this.config.difficulty * 20);

    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setFollowOffset(-100, 0);

    // Set world bounds
    const worldW = this.levelData.width * TILE_SIZE * 2;
    const worldH = this.levelData.height * TILE_SIZE * 2;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // Player gravity
    const gravity = this.config.physics?.gravity || 800;
    this.playerBody.setGravityY(gravity);
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!this.roundActive) return;

    const jumpForce = this.config.physics?.jumpForce || 400;

    // Auto-scroll
    this.playerBody.setVelocityX(this.scrollSpeed);

    // Jump with coyote time + jump buffering
    this.updatePlatformerPhysics(jumpForce);

    // Duck
    if (this.isDownKeyDown() && !this.isDucking) {
      this.isDucking = true;
      this.player.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE * 0.5);
      this.playerBody.setSize(TILE_SIZE * 1.5, TILE_SIZE);
    } else if (!this.isDownKeyDown() && this.isDucking) {
      this.isDucking = false;
      this.player.setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);
      this.playerBody.setSize(TILE_SIZE * 1.5, TILE_SIZE * 1.8);
    }

    // Speed increases over time
    this.scrollSpeed += delta * 0.002 * this.config.difficulty;

    // Distance score
    this.distanceScore = Math.floor(this.player.x / 50);
    this.score = this.distanceScore + this.baseCollectScore;
    this.scoreText.setText(`Score: ${this.score}`);

    // Respawn if fallen
    if (this.player.y > this.levelData.height * TILE_SIZE * 2 + 50) {
      this.player.setPosition(this.player.x + 100, this.levelData.playerSpawnY * 2);
      this.playerBody.setVelocity(this.scrollSpeed, 0);
      this.baseCollectScore -= 10;
    }
  }

  protected onCollectItem(
    player: Phaser.GameObjects.Sprite,
    item: Phaser.GameObjects.Sprite
  ): void {
    item.destroy();
    this.baseCollectScore += this.config.scoring?.collectiblePoints || 10;
    // Particle burst
    const particles = this.add.particles(item.x, item.y, "collectible", {
      speed: { min: 50, max: 100 },
      scale: { start: 0.5, end: 0 },
      lifespan: 300,
      quantity: 5,
    });
    this.time.delayedCall(400, () => particles.destroy());
  }
}
