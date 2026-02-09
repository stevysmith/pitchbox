# pitch.box

AI-powered party games for remote teams. Drop a prompt, get a game, play in 5 minutes.

## Stack

- **Frontend**: Next.js 14 + Tailwind CSS + Framer Motion
- **Backend**: Convex (real-time database + serverless functions)
- **AI**: Anthropic Claude Opus 4.6 (game generation)
- **Assets**: Google Gemini (optional image generation)

## Setup

```bash
# Install dependencies
npm install

# Set up Convex
npx convex dev --once

# Set environment variables in Convex dashboard
npx convex env set ANTHROPIC_API_KEY sk-ant-...

# Create .env.local with your Convex URL
cp .env.local.example .env.local
# Edit .env.local with your NEXT_PUBLIC_CONVEX_URL

# Run development
npm run dev
```

## How It Works

1. **Create** - Type a 2-sentence prompt describing your game vibe
2. **Share** - Get a 4-letter room code, share with your team
3. **Play** - Everyone joins from their phone/laptop, game runs in real-time
4. **Vibe** - 4-6 rounds, 5 minutes total, instant laughs

## License

This project is licensed under the [PolyForm Shield License 1.0.0](LICENSE). You can view, fork, and learn from the code, but you may not use it to build a competing product.
