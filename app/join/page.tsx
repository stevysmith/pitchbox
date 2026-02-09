"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleJoin = () => {
    if (code.trim().length === 4) {
      router.push(`/play/${code.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          <span className="font-display font-bold text-xl text-text">
            pitch.box
          </span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8 text-center"
        >
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-display font-bold">
              Join the chaos
            </h1>
            <p className="text-text-muted text-lg">
              Enter the room code from your host
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              maxLength={4}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="ABCD"
              className="w-full text-center text-5xl font-mono font-bold tracking-[0.5em] bg-surface border-2 border-surface-light rounded-2xl px-6 py-6 text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
              autoFocus
            />

            <button
              onClick={handleJoin}
              disabled={code.length !== 4}
              className="w-full py-4 bg-accent text-white rounded-xl font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-all active:scale-[0.98]"
            >
              Join Game
            </button>
          </div>

          <Link
            href="/"
            className="text-text-muted hover:text-text text-sm transition-colors inline-block"
          >
            or create your own game
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
