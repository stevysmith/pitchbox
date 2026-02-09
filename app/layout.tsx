import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pitchbox.onrender.com"),
  title: "pitch.box — AI Party Games for Teams",
  description:
    "Drop a vibe, get a game. AI-generated multiplayer party games your team can play in 5 minutes. No downloads. No rules to read.",
  openGraph: {
    title: "pitch.box — drop a vibe, get a game",
    description:
      "AI-generated multiplayer party games your team can play in 5 minutes. No downloads. No rules to read.",
    url: "https://pitchbox.onrender.com",
    siteName: "pitch.box",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "pitch.box — drop a vibe, get a game. AI-generated multiplayer party games.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "pitch.box — drop a vibe, get a game",
    description:
      "AI-generated multiplayer party games your team can play in 5 minutes. No downloads. No rules to read.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "pitch.box — drop a vibe, get a game. AI-generated multiplayer party games.",
      },
    ],
  },
  appleWebApp: {
    title: "pitch.box",
    statusBarStyle: "black-translucent",
    capable: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-bg bg-grid overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
