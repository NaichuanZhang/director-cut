# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What is SayCut?

SayCut is a voice-first AI movie director. Users speak or type a story idea, and the app autonomously writes a script, generates keyframe images, and films cinematic video clips. Built for the Google DeepMind multi-model hackathon.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm start        # Serve production build
```

No linter or test runner is configured. `test-app.py` is a manual Playwright smoke test (`python test-app.py` with dev server running on port 3001).

## Environment

Uses AWS Bedrock with the `tokenmaster` AWS profile (configured in `~/.aws/credentials`). Environment variables in `.env.local`:
- `AWS_REGION` — AWS region (default: `us-west-2`)
- `SAYCUT_VIDEO_S3_BUCKET` — S3 bucket for Luma Ray video output (default: `saycut-video-output`)

## Architecture

### Agent loop (server-side)

`src/agent/agent.ts` — Agentic loop using Bedrock Converse API with Claude tool_use. Accepts text input (audio transcribed client-side via SpeechRecognition), runs up to `MAX_TOOL_ROUNDS` (6) rounds of tool calls, yields SSE events. Retry logic handles `ThrottlingException`, `ServiceUnavailableException`, `ModelTimeoutException` with exponential backoff. `summarizeForLLM` strips base64 data URIs from tool results before feeding them back to the LLM.

Pipeline per story: `generate_script` → `generate_image` (per scene) → `generate_video` (per scene).

- `src/agent/tools/` — Each tool is a separate file. `index.ts` defines the `ToolConfiguration` and the `executeTool` dispatcher.
- `src/agent/system-prompt.ts` — The agent's system prompt defining its behavior.
- `src/lib/bedrock.ts` — Singleton `BedrockRuntimeClient` and `S3Client` using `fromIni({ profile: "tokenmaster" })`.
- `src/lib/constants.ts` — All model IDs and config constants.
- `src/lib/logger.ts` — Structured logger with `[saycut]` prefix, timestamps, scopes, and levels (info/debug/warn/error).

### API route

`src/app/api/agent/stream/route.ts` — POST endpoint that wraps `streamAgent()` into an SSE stream. Has a 5-minute `maxDuration` for slow video generation.

### Client-side

- `src/stores/project-store.ts` — Zustand store holding scenes, messages, streaming state, playback state. Persisted to IndexedDB via `zustand/middleware/persist` + `src/lib/idb-storage.ts` (scenes and messages only; transient UI state excluded).
- `src/hooks/use-agent.ts` — Consumes the SSE stream, dispatches events to the store. Scene IDs are generated client-side.
- `src/hooks/use-audio-recorder.ts` — MediaRecorder + SpeechRecognition wrapper. Transcribes audio client-side and sends as text (since Claude on Bedrock doesn't accept audio inline).
- `src/components/app-shell.tsx` — Root layout: left sidebar (AgentPanel) + main area (scene grid or ScenePlayer).
- `src/components/voice-orb.tsx` — Voice recording button + text input.
- `src/components/scene-card.tsx` — Scene card with status badge, image preview, video play overlay.
- `src/components/scene-player.tsx` — Full-screen sequential playback of completed scenes.
- `src/components/agent-panel.tsx` — Chat-style message history with tool progress indicators.

### Styling

Tailwind v4 with CSS custom properties in `globals.css`. Warm cinema palette (dark bg, terracotta accent). Three font families: DM Sans (body), Instrument Serif (display), Geist Mono (code). Animations via `framer-motion` and CSS keyframes.

## Key Conventions

- All data types use `readonly` properties (see `src/lib/types.ts`).
- Images are base64 data URIs (PNG); videos are base64 data URIs (MP4, downloaded from S3 after Luma Ray generation).
- Scene status lifecycle: `empty` → `scripted` → `imaging` → `filming` → `complete` (or `error`).
- Conversation history is NOT passed between requests yet (empty array in route.ts). Base64 data URIs are stripped from tool results before feeding back to the LLM (`summarizeForLLM` in agent.ts).

## Amazon Bedrock Models

| Constant | Model ID | Purpose |
|----------|----------|---------|
| AGENT | us.anthropic.claude-sonnet-4-6 | Orchestrator agent (Converse API, inference profile) |
| SCRIPT | us.anthropic.claude-sonnet-4-6 | Script generation (tool_use for structured output) |
| IMAGE | stability.sd3-5-large-v1:0 | Keyframe images (InvokeModel) |
| VIDEO | luma.ray-v2:0 | Video clips (StartAsyncInvoke → S3 → download) |
