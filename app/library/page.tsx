"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { motion } from "framer-motion";
import Link from "next/link";

export default function LibraryPage() {
  const games = useQuery(api.games.getRecent, { limit: 50 });

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          <span className="font-display font-bold text-xl text-text">
            pitch.box
          </span>
        </Link>
        <Link
          href="/"
          className="px-4 py-2 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent/90 transition-colors"
        >
          Create Game
        </Link>
      </header>

      <main className="flex-1 px-4 pb-8 max-w-3xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold">
              Game Library
            </h1>
            <p className="text-text-muted">
              All the games that have been generated. Tap to remix.
            </p>
          </div>

          {games === undefined ? (
            <div className="text-center py-12 text-text-muted">Loading...</div>
          ) : games.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="text-5xl">🎮</div>
              <p className="text-text-muted text-lg">
                No games yet. Be the first to create one!
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-colors"
              >
                Create a Game
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {games.map((game: any, i: number) => (
                <motion.div
                  key={game._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/?prompt=${encodeURIComponent(game.prompt)}`}
                    className="block glass rounded-xl p-4 card-hover"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{game.themeEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-text">
                          {game.title}
                        </h3>
                        <p className="text-text-muted text-sm mt-0.5">
                          {game.tagline}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-text-dim">
                            {new Date(game.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs bg-surface-light px-2 py-0.5 rounded-full text-text-dim">
                            {game.themeMood}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-text-dim mt-2 line-clamp-1">
                      Prompt: &ldquo;{game.prompt}&rdquo;
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
