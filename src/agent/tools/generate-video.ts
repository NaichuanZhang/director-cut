/**
 * Video Generation Tool — Seedance 2.0
 *
 * Generates cinematic video clips using the Seedance 2.0 model.
 * Supports first-frame keyframe control, scene chaining, and configurable
 * director settings (duration, resolution, camera, audio).
 */

import {
  generateVideo as seedanceGenerate,
  type SeedanceProgressInfo,
} from "@/lib/seedance-client";
import {
  storeLastFrame,
  getFirstFrameForScene,
} from "@/lib/scene-chaining";
import {
  type DirectorSettings,
  DEFAULT_DIRECTOR_SETTINGS,
} from "@/lib/director-controls";
import { log } from "@/lib/logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VideoGenerationResult {
  readonly sceneId: string;
  readonly videoUrl: string;
  readonly lastFrameBase64?: string;
}

export interface VideoGenerationOptions {
  /** Scene ID */
  readonly sceneId: string;
  /** Visual description of what happens */
  readonly visualDescription: string;
  /** Audio/dialogue directions */
  readonly dialogueDirections: string;
  /** Progress callback */
  readonly onProgress?: (sceneId: string, pct: number) => void;
  /** Keyframe image (base64 PNG from image generation step) */
  readonly keyframeBase64?: string;
  /** Scene index in the project */
  readonly sceneIndex?: number;
  /** All scene IDs in order (for chaining) */
  readonly allSceneIds?: readonly string[];
  /** Director settings override */
  readonly settings?: DirectorSettings;
}

// ─── Main Function ──────────────────────────────────────────────────────────

export async function generateVideo(
  sceneId: string,
  visualDescription: string,
  dialogueDirections: string,
  onProgress?: (sceneId: string, pct: number) => void,
  keyframeBase64?: string,
  sceneIndex?: number,
  allSceneIds?: readonly string[],
  settings?: DirectorSettings,
): Promise<VideoGenerationResult> {
  const cfg = settings ?? DEFAULT_DIRECTOR_SETTINGS;

  // Build the prompt combining visual and audio directions
  const prompt = `${visualDescription}. Audio directions: ${dialogueDirections}`;

  log.info("generate_video", `Starting Seedance generation for ${sceneId}`, {
    promptLength: prompt.length,
    hasKeyframe: !!keyframeBase64,
    sceneIndex,
    duration: cfg.duration,
    resolution: cfg.resolution,
    chainScenes: cfg.chainScenes,
  });

  // Determine the first frame using chaining logic
  let firstFrame: string | undefined;

  if (cfg.chainScenes && sceneIndex !== undefined && allSceneIds) {
    firstFrame = getFirstFrameForScene(
      sceneId,
      sceneIndex,
      allSceneIds,
      keyframeBase64,
    );
  } else {
    firstFrame = keyframeBase64;
  }

  // Generate the video
  const result = await seedanceGenerate(
    {
      prompt,
      duration: cfg.duration,
      resolution: cfg.resolution,
      ratio: cfg.aspectRatio,
      cameraFixed: cfg.cameraFixed,
      generateAudio: cfg.generateAudio,
      returnLastFrame: cfg.chainScenes,
      firstFrameBase64: firstFrame,
      seed: cfg.seed,
    },
    (info: SeedanceProgressInfo) => {
      onProgress?.(sceneId, info.percent);
    },
  );

  // Store last frame for chaining to next scene
  if (result.lastFrameBase64 && cfg.chainScenes) {
    storeLastFrame(sceneId, result.lastFrameBase64);
  }

  // Download the video and convert to base64 data URI
  const videoDataUri = await downloadVideoAsDataUri(result.videoUrl);

  log.info("generate_video", `Video ready for ${sceneId}`, {
    taskId: result.taskId,
    hasLastFrame: !!result.lastFrameBase64,
  });

  onProgress?.(sceneId, 100);

  return {
    sceneId,
    videoUrl: videoDataUri,
    lastFrameBase64: result.lastFrameBase64,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function downloadVideoAsDataUri(url: string): Promise<string> {
  log.debug("generate_video", "Downloading video from URL", {
    url: url.slice(0, 80),
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  log.debug("generate_video", "Video downloaded", {
    sizeKB: Math.round(buffer.byteLength / 1024),
  });

  return `data:video/mp4;base64,${base64}`;
}
