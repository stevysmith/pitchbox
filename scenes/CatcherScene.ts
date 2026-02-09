import * as Phaser from "phaser";
import { BaseScene } from "./BaseScene";
import { TILE_SIZE, COLLECTIBLE_DISPLAY_SIZE, HAZARD_DISPLAY_SIZE } from "../lib/phaserTypes";
import { ObjectPool } from "../lib/ObjectPool";

export class CatcherScene extends BaseScene {
  private goodItemPool: ObjectPool | null = null;
  private badItemPool: ObjectPool | null = null;
  private goodSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private badSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private elapsedTime: number = 0;
  private baseFallSpeed: number = 150;

  constructor() {
    super("CatcherScene");
  }

  create(): void {
    super.create();

    // No gravity on player — constrain to bottom row, left/right only
    this.playerBody.setAllowGravity(false);

    const worldW = this.levelData.width * TILE_SIZE * 2;
    const worldH = this.levelData.height * TILE_SIZE * 2;
    this.physics.world.setBounds(0, 0, worldW, worldH);

    // Position player at bottom
    this.player.setPosition(worldW / 2, worldH - TILE_SIZE * 4);

    // Item pools
    this.goodItemPool = new ObjectPool(this, "collectible", COLLECTIBLE_DISPLAY_SIZE, 10);
    this.badItemPool = new ObjectPool(this, "hazard", HAZARD_DISPLAY_SIZE, 8);

    // Overlap: player catches good items
    this.physics.add.overlap(
      this.player,
      this.goodItemPool.getGroup(),
      this.onCatchGoodItem as any,
      undefined,
      this
    );

    // Overlap: player catches bad items
    this.physics.add.overlap(
      this.player,
      this.badItemPool.getGroup(),
      this.onCatchBadItem as any,
      undefined,
      this
    );

    this.baseFallSpeed = this.config.catcher?.fallSpeed || 150;

    // Spawn good items
    const goodRate = this.config.catcher?.goodItemRate || 1200;
    this.goodSpawnTimer = this.time.addEvent({
      delay: goodRate,
      callback: this.spawnGoodItem,
      callbackScope: this,
      loop: true,
    });

    // Spawn bad items
    const badRate = this.config.catcher?.badItemRate || 2500;
    this.badSpawnTimer = this.time.addEvent({
      delay: badRate,
      callback: this.spawnBadItem,
      callbackScope: this,
      loop: true,
    });
  }

  private spawnGoodItem(): void {
    if (!this.roundActive) return;

    const worldW = this.levelData.width * TILE_SIZE * 2;
    const margin = TILE_SIZE * 4;
    const x = margin + Math.random() * (worldW - margin * 2);

    const item = this.goodItemPool!.spawn(x, -TILE_SIZE * 2);
    const body = item.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    const speed = this.baseFallSpeed + this.elapsedTime * 3 + this.config.difficulty * 15;
    body.setVelocityY(speed);
    body.setVelocityX((Math.random() - 0.5) * 30);

    // Despawn when off screen
    this.time.delayedCall(6000, () => {
      if (item.active) this.goodItemPool!.despawn(item);
    });
  }

  private spawnBadItem(): void {
    if (!this.roundActive) return;

    const worldW = this.levelData.width * TILE_SIZE * 2;
    const margin = TILE_SIZE * 4;
    const x = margin + Math.random() * (worldW - margin * 2);

    const item = this.badItemPool!.spawn(x, -TILE_SIZE * 2);
    const body = item.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    const speed = this.baseFallSpeed + this.elapsedTime * 2 + this.config.difficulty * 10;
    body.setVelocityY(speed);
    body.setVelocityX((Math.random() - 0.5) * 50);

    // Pulsing red tint to distinguish bad items
    this.tweens.add({
      targets: item,
      alpha: 0.6,
      duration: 200,
      yoyo: true,
      repeat: -1,
    });

    this.time.delayedCall(6000, () => {
      if (item.active) this.badItemPool!.despawn(item);
    });
  }

  private onCatchGoodItem(
    player: Phaser.GameObjects.Sprite,
    item: Phaser.GameObjects.Sprite
  ): void {
    const ix = item.x;
    const iy = item.y;
    this.goodItemPool?.despawn(item as Phaser.Physics.Arcade.Sprite);
    const points = this.config.scoring?.collectiblePoints || 10;
    this.addScore(points);

    // Juice: collect burst
    this.juice?.collectBurst(ix, iy, points, "collectible");
    this.audio?.playSFX("collect");
  }

  private onCatchBadItem(
    player: Phaser.GameObjects.Sprite,
    item: Phaser.GameObjects.Sprite
  ): void {
    this.badItemPool?.despawn(item as Phaser.Physics.Arcade.Sprite);
    const penalty = this.config.catcher?.badItemPenalty || 15;
    this.addScore(-penalty);

    // Juice: damage flash
    this.juice?.damageFlash(this.player, -penalty);
    this.audio?.playSFX("hit");
  }

  update(time: number, delta: number): void {
    super.update(time, delta);
    if (!this.roundActive) return;

    this.elapsedTime += delta / 1000;

    const speed = this.config.physics?.playerSpeed || 280;

    // Left/right movement with acceleration for momentum feel
    let vx = 0;
    if (this.isLeftDown()) vx = -speed;
    if (this.isRightDown()) vx = speed;
    this.playerBody.setAccelerationX(vx * 5);
    this.playerBody.setDragX(speed * 3);
    this.playerBody.setMaxVelocityX(speed);

    // Keep Y position fixed at bottom
    this.player.y = this.levelData.height * TILE_SIZE * 2 - TILE_SIZE * 4;

    // Flip sprite
    if (vx < 0) this.player.setFlipX(true);
    if (vx > 0) this.player.setFlipX(false);
  }

  shutdown(): void {
    super.shutdown();
    this.goodSpawnTimer?.destroy();
    this.badSpawnTimer?.destroy();
    this.goodItemPool?.destroy();
    this.badItemPool?.destroy();
  }
}
