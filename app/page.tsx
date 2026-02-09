"use client";

import { useState, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionId } from "./providers";
import { EXAMPLE_PROMPTS, PLAYER_EMOJIS } from "@/lib/gameTypes";
import { cn } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const sessionId = useSessionId();
  const [prompt, setPrompt] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(
    PLAYER_EMOJIS[Math.floor(Math.random() * PLAYER_EMOJIS.length)]
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [step, setStep] = useState<"name" | "prompt">("name");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const generateGame = useAction(api.gameFlow.generateAndCreateGame);
  const recentGames = useQuery(api.games.getRecent, { limit: 6 });

  const handleGenerate = async () => {
    if (!prompt.trim() || !playerName.trim() || !sessionId) return;
    setIsGenerating(true);
    setError("");

    try {
      const result = await generateGame({
        prompt: prompt.trim(),
        hostName: playerName.trim(),
        hostEmoji: selectedEmoji,
        sessionId,
      });
      router.push(`/play/${result.code}`);
    } catch (e: any) {
      setError(e.message || "Failed to generate game. Try again!");
      setIsGenerating(false);
    }
  };

  const handleJoin = () => {
    if (joinCode.trim().length === 4) {
      router.push(`/play/${joinCode.trim().toUpperCase()}`);
    }
  };

  const loadingMessages = [
    "cooking up something unhinged...",
    "generating peak chaos...",
    "the vibes are loading...",
    "this is gonna be fire...",
    "assembling the chaos engine...",
  ];

  if (isGenerating) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-8"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-7xl mx-auto w-fit"
          >
            {selectedEmoji}
          </motion.div>
          <div className="space-y-3">
            <h2 className="text-2xl font-display font-bold text-text">
              Generating your game
            </h2>
            <motion.p
              key={Math.floor(Date.now() / 3000)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-text-muted text-lg"
            >
              {loadingMessages[Math.floor(Math.random() * loadingMessages.length)]}
            </motion.p>
          </div>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-accent"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          <span className="font-display font-bold text-xl text-text">
            pitch.box
          </span>
        </div>
        <button
          onClick={() => setShowJoin(!showJoin)}
          className={cn(
            "px-4 py-2 rounded-xl font-semibold text-sm transition-all",
            showJoin
              ? "bg-surface-light text-text-muted"
              : "bg-accent text-white hover:bg-accent/90"
          )}
        >
          {showJoin ? "Create Instead" : "Join Game"}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-8 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {showJoin ? (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-6 text-center"
            >
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-display font-bold">
                  Join the chaos
                </h1>
                <p className="text-text-muted text-lg">
                  Enter the 4-letter room code
                </p>
              </div>
              <div className="flex justify-center">
                <input
                  type="text"
                  maxLength={4}
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="ABCD"
                  className="w-64 text-center text-4xl font-mono font-bold tracking-[0.5em] bg-surface border-2 border-surface-light rounded-2xl px-6 py-4 text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors"
                  autoFocus
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={joinCode.length !== 4}
                className="px-8 py-3 bg-accent text-white rounded-xl font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-all"
              >
                Join
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-8"
            >
              {/* Hero */}
              <div className="text-center space-y-3">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl md:text-6xl font-display font-bold glow-text"
                >
                  drop a vibe,
                  <br />
                  <span className="bg-gradient-to-r from-accent-light via-ice to-hot bg-clip-text text-transparent">
                    get a game
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-text-muted text-lg md:text-xl max-w-md mx-auto"
                >
                  AI-generated party games your team can play in 5 minutes.
                  No downloads. No rules to read. Just vibes.
                </motion.p>
              </div>

              <AnimatePresence mode="wait">
                {step === "name" ? (
                  <motion.div
                    key="name-step"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    {/* Name Input */}
                    <div className="glass rounded-2xl p-5 space-y-4">
                      <label className="text-sm font-medium text-text-muted">
                        What should we call you?
                      </label>
                      <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && playerName.trim() && setStep("prompt")
                        }
                        placeholder="Your name"
                        maxLength={20}
                        className="w-full bg-surface-light rounded-xl px-4 py-3 text-text text-lg placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
                        autoFocus
                      />

                      {/* Emoji Picker */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-text-muted">
                          Pick your avatar
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {PLAYER_EMOJIS.slice(0, 16).map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setSelectedEmoji(emoji)}
                              className={cn(
                                "w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all",
                                selectedEmoji === emoji
                                  ? "bg-accent/20 ring-2 ring-accent scale-110"
                                  : "bg-surface-light hover:bg-surface-hover"
                              )}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setStep("prompt")}
                      disabled={!playerName.trim()}
                      className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/90 transition-all active:scale-[0.98]"
                    >
                      Continue
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="prompt-step"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    {/* Player Badge */}
                    <button
                      onClick={() => setStep("name")}
                      className="flex items-center gap-2 text-text-muted hover:text-text transition-colors text-sm"
                    >
                      <span className="text-lg">{selectedEmoji}</span>
                      <span className="font-medium">{playerName}</span>
                      <span className="text-text-dim">· tap to edit</span>
                    </button>

                    {/* Prompt Input */}
                    <div className="glass rounded-2xl p-5 space-y-3">
                      <label className="text-sm font-medium text-text-muted">
                        Describe your game vibe in 1-2 sentences
                      </label>
                      <textarea
                        ref={inputRef}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerate();
                          }
                        }}
                        placeholder="We're a team of space pirates fighting over the last slice of cosmic pizza..."
                        rows={3}
                        maxLength={300}
                        className="w-full bg-surface-light rounded-xl px-4 py-3 text-text text-lg placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-none"
                        autoFocus
                      />
                      <div className="text-right text-xs text-text-dim">
                        {prompt.length}/300
                      </div>
                    </div>

                    {/* Example Prompts */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-text-dim uppercase tracking-wider">
                        or try one of these
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {EXAMPLE_PROMPTS.slice(0, 4).map((example) => (
                          <button
                            key={example}
                            onClick={() => {
                              setPrompt(example);
                              inputRef.current?.focus();
                            }}
                            className="text-left text-sm px-3 py-2 bg-surface-light hover:bg-surface-hover rounded-lg text-text-muted hover:text-text transition-all line-clamp-1"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerate}
                      disabled={!prompt.trim()}
                      className="w-full py-4 bg-gradient-to-r from-accent to-ice text-white rounded-xl font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all active:scale-[0.98] glow-box"
                    >
                      Generate Game ✨
                    </button>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-hot text-sm text-center"
                      >
                        {error}
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Games */}
        {!showJoin && recentGames && recentGames.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 w-full space-y-4"
          >
            <h3 className="text-sm font-medium text-text-dim uppercase tracking-wider text-center">
              Recent Games
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {recentGames.map((game: any) => (
                <button
                  key={game._id}
                  onClick={() => setPrompt(game.prompt)}
                  className="glass rounded-xl p-3 text-left card-hover space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{game.themeEmoji}</span>
                    <span className="font-semibold text-sm text-text truncate">
                      {game.title}
                    </span>
                  </div>
                  <p className="text-xs text-text-dim line-clamp-2">
                    {game.tagline}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
