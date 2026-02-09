"use client";

export default function OGImage() {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        background: "#0a0a0b",
        backgroundImage:
          "linear-gradient(rgba(124, 58, 237, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(124, 58, 237, 0.06) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow orbs */}
      <div
        style={{
          position: "absolute",
          top: -120,
          left: -80,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -100,
          right: -60,
          width: 350,
          height: 350,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 200,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(244, 63, 94, 0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Floating emoji */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
          fontSize: 48,
          opacity: 0.3,
          transform: "rotate(-15deg)",
        }}
      >
        🎯
      </div>
      <div
        style={{
          position: "absolute",
          top: 100,
          right: 120,
          fontSize: 40,
          opacity: 0.25,
          transform: "rotate(12deg)",
        }}
      >
        🏆
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 140,
          fontSize: 44,
          opacity: 0.25,
          transform: "rotate(8deg)",
        }}
      >
        🔥
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 80,
          right: 160,
          fontSize: 36,
          opacity: 0.2,
          transform: "rotate(-10deg)",
        }}
      >
        ⚡
      </div>

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span style={{ fontSize: 64 }}>🎮</span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#f5f5f7",
              letterSpacing: "-0.02em",
              textShadow:
                "0 0 40px rgba(124, 58, 237, 0.5), 0 0 80px rgba(124, 58, 237, 0.2)",
            }}
          >
            pitch.box
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            textAlign: "center" as const,
            lineHeight: 1.3,
          }}
        >
          <span style={{ color: "#a1a1aa" }}>drop a vibe, </span>
          <span
            style={{
              background:
                "linear-gradient(90deg, #a78bfa, #06b6d4, #f43f5e)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            get a game
          </span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: 22,
            color: "#71717a",
            textAlign: "center" as const,
            maxWidth: 700,
            lineHeight: 1.5,
          }}
        >
          AI-generated multiplayer party games your team can play in 5 minutes.
          No downloads. No rules to read.
        </p>

        {/* Fake prompt input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#141416",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "14px 24px",
            width: 600,
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 18, color: "#52525b" }}>
            &quot;Space pirates fighting over cosmic pizza...&quot;
          </span>
          <div style={{ marginLeft: "auto" }}>
            <div
              style={{
                background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
                borderRadius: 10,
                padding: "8px 20px",
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              Generate ✨
            </div>
          </div>
        </div>
      </div>

      {/* Bottom URL */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#52525b",
          fontSize: 16,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        pitchbox.onrender.com
      </div>

      {/* Hide Next.js dev indicators */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap');
          [data-nextjs-dialog-overlay],
          [data-nextjs-dialog],
          nextjs-portal,
          #__next-build-indicator {
            display: none !important;
          }
        `,
        }}
      />
    </div>
  );
}
