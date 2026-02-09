import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("pb-session-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("pb-session-id", id);
  }
  return id;
}

export function getRandomEmoji(): string {
  const emojis = [
    "🦊", "🐙", "🌵", "🍕", "🎸", "🚀", "🦄", "🐸",
    "🔥", "💀", "👽", "🤖", "🎭", "🧊", "⚡", "🌈",
  ];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

export function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
