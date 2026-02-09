import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "pitch.box — AI Party Games for Teams",
  description:
    "Drop a prompt, get a game, play in 5 minutes. AI-powered party games for remote teams.",
  openGraph: {
    title: "pitch.box",
    description: "AI-powered party games for remote teams",
    type: "website",
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
