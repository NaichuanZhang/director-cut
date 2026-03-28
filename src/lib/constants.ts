export const MODELS = {
  AGENT: "gemini-3-flash-preview",
  SCRIPT: "gemini-3-flash-preview",
  IMAGE: "imagen-4.0-generate-001",
  VIDEO: "veo-3.1-generate-preview",
  VIDEO_FAST: "veo-3.1-fast-generate-preview",
  TTS: "gemini-2.5-flash-preview-tts",
  LIVE: "gemini-3.1-flash-live-preview",
} as const;

export const VIDEO_POLL_INTERVAL_MS = 5_000;
export const VIDEO_MAX_WAIT_MS = 120_000;
export const MAX_TOOL_ROUNDS = 6;
export const DEFAULT_NUM_SCENES = 3;
export const VIDEO_DURATION_SECONDS = 6;
export const VIDEO_RESOLUTION = "720p";
export const VIDEO_ASPECT_RATIO = "16:9";
export const TTS_VOICE = "Kore";
