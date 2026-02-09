import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE, HAZARD_DISPLAY_SIZE } from "../lib/phaserTypes";
import { createHazardSprite } from "../lib/SpriteFactory";
import { ObjectPool } from "../lib/ObjectPool";

export class DodgeScene extends BaseScene {
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private fallingPool: ObjectPool | null = null;
  private survivalTime: number = 0;
  private spawnInterval: number = 800;
  private alive: boolean = true;

  constructor() {
    super("DodgeScene");
  }

  create(): void {
    super.create();

    // Gravity for falling objects, no gravity for player (left/right only)
    this.playerBody.setAllowGravity(false);

    const worldW = this.levelData.width * TILE_SIZE * 2;
    const worldH = this.levelData.height * TILE_SIZE * 2;
    this.physics.world.setBounds(0, 0, worldW, worldH);

    // Player constrained to bottom area
    this.player.setPosition(worldW / 2, worldH - TILE_SIZE * 4);

    // Falling objects pool
    this.fallingPool = new ObjectPool(this, "hazard", HAZARD_DISPLAY_SIZE, 15);

    // Collision: player vs ground
    this.physics.add.collider(this.player, this.groundGroup);

    // Overlap: player vs falling objects
    this.physics.add.overlap(
      this.player,
      this.fallingPool.getGroup(),
      this.onHitFallingObject as any,
      undefined,
      this
    );

    // Start spawning
    this.spawnInterval = Math.max(200, 800 - this.config.difficulty * 100);
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnInterval,
      callback: this.spawnFallingObject,
      callbackScope: this,
      loop: true,
    });
  }

  private spawnFallingObject(): void {
    if (!this.roundActive || !this.alive) return;

    const worldW = this.levelData.width * TILE_SIZE * 2;
    const margin = TILE_SIZE * 4;
    const x = margin + Math.random() * (worldW - margin * 2);

    const obj = this.fallingPool!.spawn(x, -TILE_SIZE * 2);
    (obj.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);

    const fallSpeed = 100 + this.config.difficulty * 40 + this.survivalTime * 2;
    (obj.body as Phaser.Physics.Arcade.Body).setVelocityY(fallSpeed);
    (obj.body as Phaser.Physics.Arcade.Body).setVelocityX((Math.random() - 0.5) * 40);

    // Despawn when off screen
    this.time.delayedCall(5000, () => {
      if (obj.active) this.fallingPool!.despawn(obj);
    });

    // Increase difficulty over time by spawning new timer
    if (this.spawnTimer && this.spawnInterval > 200) {
      this.spawnInterval = Math.max(200, this.spawnInterval - 5);
      this.spawnTimer.destroy();
      this.spawnTimer = this.time.addEvent({
        delay: this.spawnInterval,
        callback: this.spawnFallingObject,
        callbackScope: this,
        loop: true,
      });
    }
  }

  private onHitFallingObject(
    player: Phaser.GameObjects.Sprite,
    obj: Phaser.GameObjects.Sprite
  ): void {
    if (!this.alive) return;
    this.fallingPool?.despawn(obj as Phaser.Physics.Arcade.Sprite);
    this.addScore(-15);
    this.juice?.damageFlash(this.player, -15);
    this.juice?.hitFreeze(40);
    this.audio?.playSFX("hit");

    // Knock player
    const dx = this.player.x > obj.x ? 100 : -100;
    this.playerBody.setVelocityX(dx);
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!this.roundActive || !this.alive) return;

    const speed = this.config.physics?.playerSpeed || 250;

    // Left/right movement with acceleration for momentum feel
    let vx = 0;
    if (this.isLeftDown()) vx = -speed;
    if (this.isRightDown()) vx = speed;
    this.playerBody.setAccelerationX(vx * 5);
    this.playerBody.setDragX(speed * 3);
    this.playerBody.setMaxVelocityX(speed);
    // Keep Y position fixed at bottom
    this.player.y = this.levelData.height * TILE_SIZE * 2 - TILE_SIZE * 4;

    // Survival time score
    this.survivalTime += delta / 1000;
    const survivalPoints = Math.floor(this.survivalTime * (this.config.scoring?.survivalBonusPerSecond || 3));
    this.score = survivalPoints;
    this.scoreText.setText(`Score: ${this.score}`);

    // Flip sprite
    if (vx < 0) this.player.setFlipX(true);
    if (vx > 0) this.player.setFlipX(false);
  }

  shutdown(): void {
    super.shutdown();
    this.spawnTimer?.destroy();
    this.fallingPool?.destroy();
  }
}
