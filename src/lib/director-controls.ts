/**
 * Director Controls Configuration
 *
 * Defines the configurable parameters for video generation that
 * users can tweak via the UI (camera, duration, resolution, etc.).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type VideoDuration = 5 | 10;
export type VideoResolution = "480p" | "720p" | "1080p";
export type VideoAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";

export interface DirectorSettings {
  readonly duration: VideoDuration;
  readonly resolution: VideoResolution;
  readonly aspectRatio: VideoAspectRatio;
  readonly cameraFixed: boolean;
  readonly generateAudio: boolean;
  readonly chainScenes: boolean;
  readonly seed?: number;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_DIRECTOR_SETTINGS: DirectorSettings = {
  duration: 5,
  resolution: "720p",
  aspectRatio: "16:9",
  cameraFixed: false,
  generateAudio: true,
  chainScenes: true,
  seed: undefined,
};

// ─── Options for UI dropdowns ───────────────────────────────────────────────

export const DURATION_OPTIONS: readonly { value: VideoDuration; label: string }[] = [
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
];

export const RESOLUTION_OPTIONS: readonly { value: VideoResolution; label: string }[] = [
  { value: "480p", label: "480p (Fast)" },
  { value: "720p", label: "720p (Balanced)" },
  { value: "1080p", label: "1080p (Quality)" },
];

export const ASPECT_RATIO_OPTIONS: readonly {
  value: VideoAspectRatio;
  label: string;
  icon: string;
}[] = [
  { value: "16:9", label: "16:9 Widescreen", icon: "🎬" },
  { value: "9:16", label: "9:16 Vertical", icon: "📱" },
  { value: "1:1", label: "1:1 Square", icon: "⬜" },
  { value: "4:3", label: "4:3 Classic", icon: "📺" },
  { value: "3:4", label: "3:4 Portrait", icon: "🖼️" },
];

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateSettings(settings: Partial<DirectorSettings>): DirectorSettings {
  return {
    duration: settings.duration ?? DEFAULT_DIRECTOR_SETTINGS.duration,
    resolution: settings.resolution ?? DEFAULT_DIRECTOR_SETTINGS.resolution,
    aspectRatio: settings.aspectRatio ?? DEFAULT_DIRECTOR_SETTINGS.aspectRatio,
    cameraFixed: settings.cameraFixed ?? DEFAULT_DIRECTOR_SETTINGS.cameraFixed,
    generateAudio: settings.generateAudio ?? DEFAULT_DIRECTOR_SETTINGS.generateAudio,
    chainScenes: settings.chainScenes ?? DEFAULT_DIRECTOR_SETTINGS.chainScenes,
    seed: settings.seed,
  };
}

/**
 * Estimate generation time based on settings.
 * Returns estimated seconds.
 */
export function estimateGenerationTime(settings: DirectorSettings): number {
  let baseTime = 60; // Base 60 seconds

  // Duration impact
  if (settings.duration === 10) baseTime += 40;

  // Resolution impact
  if (settings.resolution === "1080p") baseTime += 30;
  if (settings.resolution === "480p") baseTime -= 15;

  // Audio adds time
  if (settings.generateAudio) baseTime += 10;

  return Math.max(30, baseTime);
}
