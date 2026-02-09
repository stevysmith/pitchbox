import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE } from "../lib/phaserTypes";

export class PlatformerScene extends BaseScene {
  private reachedEnd: boolean = false;

  constructor() {
    super("PlatformerScene");
  }

  create(): void {
    super.create();

    // Side-view with gravity
    const gravity = this.config.physics?.gravity || 600;
    this.playerBody.setGravityY(gravity);

    const worldW = this.levelData.width * TILE_SIZE * 2;
    const worldH = this.levelData.height * TILE_SIZE * 2;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Finish flag at right end
    const flagX = (this.levelData.width - 3) * TILE_SIZE * 2;
    const flagY = this.levelData.playerSpawnY * 2;
    const flag = this.add.rectangle(flagX, flagY, TILE_SIZE * 2, TILE_SIZE * 4, 0x00ff00, 0.5);
    this.physics.add.existing(flag, true);
    this.physics.add.overlap(this.player, flag, () => {
      if (!this.reachedEnd) {
        this.reachedEnd = true;
        this.addScore(this.config.scoring?.completionBonus || 100);
        // Time bonus
        const timeBonus = Math.floor(this.timeLeft * (this.config.scoring?.speedBonusMultiplier || 5));
        this.addScore(timeBonus);
      }
    }, undefined, this);
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!this.roundActive) return;

    const speed = this.config.physics?.playerSpeed || 200;
    const jumpForce = this.config.physics?.jumpForce || 450;

    // Horizontal movement
    let vx = 0;
    if (this.isLeftDown()) vx = -speed;
    if (this.isRightDown()) vx = speed;
    this.playerBody.setVelocityX(vx);

    // Jump with coyote time + jump buffering
    this.updatePlatformerPhysics(jumpForce);

    // Flip sprite based on direction
    if (vx < 0) this.player.setFlipX(true);
    if (vx > 0) this.player.setFlipX(false);

    // Respawn if fallen
    if (this.player.y > this.levelData.height * TILE_SIZE * 2 + 50) {
      this.player.setPosition(this.levelData.playerSpawnX * 2, this.levelData.playerSpawnY * 2);
      this.playerBody.setVelocity(0, 0);
      this.addScore(-10);
    }
  }
}
