# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What is SayCut?

SayCut is a voice-first AI movie director. Users speak or type a story idea, and the app autonomously writes a script, generates keyframe images, and films cinematic video clips with full audio (dialogue, SFX, ambient sounds). Built for the Google DeepMind multi-model hackathon.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm start        # Serve production build
```

No linter or test runner is configured. `test-app.py` is a manual Playwright smoke test (`python test-app.py` with dev server running on port 3001).

## Environment

Requires `GOOGLE_API_KEY` in `.env.local` — used for all Google GenAI calls.

## Architecture

### Agent loop (server-side)

`src/agent/agent.ts` — Agentic loop using Gemini function calling. Accepts text or audio (base64 webm), runs up to `MAX_TOOL_ROUNDS` (6) rounds of tool calls, yields SSE events. Gemini API calls use `generateContentWithRetry` with exponential backoff on 429/503 errors. `summarizeForLLM` strips base64 data URIs from tool results before feeding them back to the LLM to stay within the 1M token context limit.

Pipeline per story: `generate_script` → `generate_image` (per scene) → `generate_video` (per scene, falls back to `generate_speech` on failure).

- `src/agent/tools/` — Each tool is a separate file. `index.ts` defines the function declarations and the `executeTool` dispatcher.
- `src/agent/system-prompt.ts` — The agent's system prompt defining its behavior.
- `src/lib/gemini.ts` — Singleton `GoogleGenAI` client.
- `src/lib/constants.ts` — All model IDs (Gemini 3 Flash, Imagen 4, Veo 3.1, TTS) and config constants.
- `src/lib/logger.ts` — Structured logger with `[saycut]` prefix, timestamps, scopes, and levels (info/debug/warn/error).

### API route

`src/app/api/agent/stream/route.ts` — POST endpoint that wraps `streamAgent()` into an SSE stream. Has a 5-minute `maxDuration` for slow video generation.

### Client-side

- `src/stores/project-store.ts` — Zustand store holding scenes, messages, streaming state, playback state. Persisted to IndexedDB via `zustand/middleware/persist` + `src/lib/idb-storage.ts` (scenes and messages only; transient UI state excluded).
- `src/hooks/use-agent.ts` — Consumes the SSE stream, dispatches events to the store. Scene IDs are generated client-side.
- `src/hooks/use-audio-recorder.ts` — MediaRecorder wrapper producing base64 webm audio.
- `src/components/app-shell.tsx` — Root layout: left sidebar (AgentPanel) + main area (scene grid or ScenePlayer).
- `src/components/voice-orb.tsx` — Voice recording button + text input.
- `src/components/scene-card.tsx` — Scene card with status badge, image preview, video play overlay.
- `src/components/scene-player.tsx` — Full-screen sequential playback of completed scenes.
- `src/components/agent-panel.tsx` — Chat-style message history with tool progress indicators.

### Styling

Tailwind v4 with CSS custom properties in `globals.css`. Warm cinema palette (dark bg, terracotta accent). Three font families: DM Sans (body), Instrument Serif (display), Geist Mono (code). Animations via `framer-motion` and CSS keyframes.

## Key Conventions

- All data types use `readonly` properties (see `src/lib/types.ts`).
- Images are base64 data URIs; videos are remote URIs from Veo; audio (TTS fallback) is base64 WAV.
- Scene status lifecycle: `empty` → `scripted` → `imaging` → `filming` → `complete` (or `error`).
- Conversation history is NOT passed between requests yet (empty array in route.ts). Base64 data URIs are stripped from tool results before feeding back to the LLM (`summarizeForLLM` in agent.ts).

## Google GenAI Models

| Constant | Model ID | Purpose |
|----------|----------|---------|
| AGENT | gemini-3-flash-preview | Orchestrator agent |
| SCRIPT | gemini-3-flash-preview | Script generation (JSON mode) |
| IMAGE | imagen-4.0-generate-001 | Keyframe images |
| VIDEO | veo-3.1-generate-preview | Video clips with native audio |
| VIDEO_FAST | veo-3.1-fast-generate-preview | (Available, not yet used) |
| TTS | gemini-2.5-flash-preview-tts | Speech fallback |
| LIVE | gemini-3.1-flash-live-preview | (Available, not yet used) |
