import { EventBus } from "./EventBus";
import { RemotePlayerState } from "./phaserTypes";

const SEND_RATE_MS = 100; // ~10Hz position broadcasts

export class MultiplayerManager {
  private localPlayerId: string;
  private roomId: string;
  private round: number;
  private updatePositionMutation: any;
  private lastSendTime: number = 0;
  private remotePlayers: Map<string, RemotePlayerState> = new Map();
  private unsubscribe: (() => void) | null = null;
  private destroyed: boolean = false;

  constructor(
    localPlayerId: string,
    roomId: string,
    round: number,
    updatePositionMutation: any
  ) {
    this.localPlayerId = localPlayerId;
    this.roomId = roomId;
    this.round = round;
    this.updatePositionMutation = updatePositionMutation;
  }

  sendPosition(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    animation: string
  ): void {
    if (this.destroyed) return;
    const now = Date.now();
    if (now - this.lastSendTime < SEND_RATE_MS) return;
    this.lastSendTime = now;

    try {
      this.updatePositionMutation({
        roomId: this.roomId,
        playerId: this.localPlayerId,
        x: Math.round(x),
        y: Math.round(y),
        velocityX: Math.round(velocityX),
        velocityY: Math.round(velocityY),
        animation,
        round: this.round,
      });
    } catch (e) {
      // Silently ignore send failures
    }
  }

  updateRemotePlayers(positions: any[]): void {
    if (this.destroyed) return;
    if (!positions) return;

    const now = Date.now();
    const activeIds = new Set<string>();

    for (const pos of positions) {
      if (pos.playerId === this.localPlayerId) continue;
      activeIds.add(pos.playerId);

      const existing = this.remotePlayers.get(pos.playerId);
      if (existing) {
        // Update target for interpolation
        existing.targetX = pos.x;
        existing.targetY = pos.y;
        existing.velocityX = pos.velocityX || 0;
        existing.velocityY = pos.velocityY || 0;
        existing.animation = pos.animation || "idle";
        existing.lastUpdate = now;
      } else {
        this.remotePlayers.set(pos.playerId, {
          playerId: pos.playerId,
          playerName: pos.playerName || "???",
          playerEmoji: pos.playerEmoji || "?",
          x: pos.x,
          y: pos.y,
          targetX: pos.x,
          targetY: pos.y,
          velocityX: pos.velocityX || 0,
          velocityY: pos.velocityY || 0,
          animation: pos.animation || "idle",
          color: pos.color || "#ffffff",
          lastUpdate: now,
        });
      }
    }

    // Remove stale players (no update for 5s)
    for (const [id, player] of this.remotePlayers) {
      if (!activeIds.has(id) && now - player.lastUpdate > 5000) {
        this.remotePlayers.delete(id);
      }
    }

    EventBus.emit("remote-players-updated", Array.from(this.remotePlayers.values()));
  }

  // Called every frame to interpolate remote player positions
  interpolate(delta: number): RemotePlayerState[] {
    const lerpFactor = Math.min(1, delta * 0.01); // Smooth interpolation

    for (const player of this.remotePlayers.values()) {
      player.x += (player.targetX - player.x) * lerpFactor;
      player.y += (player.targetY - player.y) * lerpFactor;
    }

    return Array.from(this.remotePlayers.values());
  }

  getRemotePlayers(): RemotePlayerState[] {
    return Array.from(this.remotePlayers.values());
  }

  destroy(): void {
    this.destroyed = true;
    this.remotePlayers.clear();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
