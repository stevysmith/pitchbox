"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo, useState, useEffect } from "react";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const convex = useMemo(() => {
    if (!CONVEX_URL) return null;
    return new ConvexReactClient(CONVEX_URL);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything on the server or during build
  if (!mounted) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg">
        <div className="text-text-muted text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!convex) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg p-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">🎮</div>
          <h1 className="text-2xl font-bold text-text">pitch.box</h1>
          <p className="text-text-muted">
            Set <code className="text-accent">NEXT_PUBLIC_CONVEX_URL</code> in your <code>.env.local</code> to get started.
          </p>
          <p className="text-text-dim text-sm">
            Run <code className="text-accent">npx convex dev</code> to set up your backend.
          </p>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

// Session ID hook — persists across tabs and page refreshes
export function useSessionId() {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    let id = localStorage.getItem("pb-session-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("pb-session-id", id);
    }
    setSessionId(id);
  }, []);

  return sessionId;
}
