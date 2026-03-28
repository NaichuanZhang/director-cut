export const MODELS = {
  AGENT: "us.anthropic.claude-sonnet-4-6",
  SCRIPT: "us.anthropic.claude-sonnet-4-6",
  IMAGE: "stability.sd3-5-large-v1:0",
  VIDEO: "luma.ray-v2:0",
} as const;

export const VIDEO_POLL_INTERVAL_MS = 10_000;
export const VIDEO_MAX_WAIT_MS = 300_000;
export const MAX_TOOL_ROUNDS = 6;
export const DEFAULT_NUM_SCENES = 3;
export const VIDEO_DURATION_SECONDS = 6;
export const VIDEO_RESOLUTION = "720p";
export const VIDEO_ASPECT_RATIO = "16:9";

export const VIDEO_OUTPUT_S3_BUCKET =
  process.env.SAYCUT_VIDEO_S3_BUCKET ?? "saycut-video-output";
export const VIDEO_OUTPUT_S3_PREFIX = "videos/";
