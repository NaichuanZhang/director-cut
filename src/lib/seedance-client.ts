/**
 * Seedance 2.0 API Client
 *
 * Handles video generation via BytePlus/Volcengine Seedance model.
 * Supports text-to-video, image-to-video, and first/last frame control.
 */

import { log } from "@/lib/logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SeedanceConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly modelEndpointId: string;
}

export interface SeedanceVideoOptions {
  /** Text prompt describing the scene */
  readonly prompt: string;
  /** Video duration in seconds: 5 or 10 */
  readonly duration?: 5 | 10;
  /** Output resolution */
  readonly resolution?: "480p" | "720p" | "1080p";
  /** Aspect ratio */
  readonly ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  /** Lock the camera (no camera motion) */
  readonly cameraFixed?: boolean;
  /** Seed for reproducibility */
  readonly seed?: number;
  /** Whether to generate audio */
  readonly generateAudio?: boolean;
  /** Whether to return the last frame (for chaining) */
  readonly returnLastFrame?: boolean;
  /** First frame image as base64 (for keyframe control) */
  readonly firstFrameBase64?: string;
  /** Last frame image as base64 (for end-state control) */
  readonly lastFrameBase64?: string;
  /** Callback URL for async notification (not used in polling mode) */
  readonly callbackUrl?: string;
}

export interface SeedanceTaskResult {
  readonly taskId: string;
  readonly videoUrl: string;
  readonly lastFrameBase64?: string;
}

export type SeedanceTaskStatus =
  | "queued"
  | "processing"
  | "rendering"
  | "complete"
  | "failed";

export interface SeedanceProgressInfo {
  readonly status: SeedanceTaskStatus;
  readonly percent: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL_MS = 8_000;
const DEFAULT_MAX_WAIT_MS = 300_000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getConfig(): SeedanceConfig {
  const apiKey = process.env.SEEDANCE_API_KEY;
  if (!apiKey) throw new Error("SEEDANCE_API_KEY environment variable is required");

  return {
    apiKey,
    baseUrl: process.env.SEEDANCE_BASE_URL ?? "https://open.volcengineapi.com",
    modelEndpointId: process.env.SEEDANCE_MODEL_ENDPOINT_ID ?? "seedance-2-0-lite-t2v",
  };
}

function buildRequestBody(options: SeedanceVideoOptions, config: SeedanceConfig): object {
  const body: Record<string, unknown> = {
    model: {
      endpoint_id: config.modelEndpointId,
    },
    content: {
      prompt: options.prompt,
    },
    parameters: {
      duration: options.duration ?? 5,
      resolution: options.resolution ?? "720p",
      ratio: options.ratio ?? "16:9",
      generate_audio: options.generateAudio ?? true,
      return_last_frame: options.returnLastFrame ?? false,
    },
  };

  const params = body.parameters as Record<string, unknown>;

  if (options.cameraFixed !== undefined) {
    params.camera_fixed = options.cameraFixed;
  }
  if (options.seed !== undefined) {
    params.seed = options.seed;
  }

  // First/last frame keyframe control
  const content = body.content as Record<string, unknown>;

  if (options.firstFrameBase64) {
    content.first_frame = {
      type: "image",
      data: options.firstFrameBase64,
    };
  }
  if (options.lastFrameBase64) {
    content.last_frame = {
      type: "image",
      data: options.lastFrameBase64,
    };
  }

  if (options.callbackUrl) {
    (body as Record<string, unknown>).callback_url = options.callbackUrl;
  }

  return body;
}

function mapApiStatus(apiStatus: string): SeedanceTaskStatus {
  switch (apiStatus.toLowerCase()) {
    case "queued":
    case "submitted":
      return "queued";
    case "running":
    case "processing":
      return "processing";
    case "rendering":
      return "rendering";
    case "completed":
    case "succeed":
      return "complete";
    case "failed":
    case "error":
      return "failed";
    default:
      return "processing";
  }
}

function estimatePercent(status: SeedanceTaskStatus, elapsed: number, maxWait: number): number {
  const timeFraction = Math.min(elapsed / maxWait, 0.95);

  switch (status) {
    case "queued":
      return Math.min(timeFraction * 100, 10);
    case "processing":
      return Math.max(10, Math.min(timeFraction * 100, 60));
    case "rendering":
      return Math.max(60, Math.min(timeFraction * 100, 90));
    case "complete":
      return 100;
    case "failed":
      return 0;
    default:
      return timeFraction * 100;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Submit a video generation task to Seedance 2.0
 */
export async function submitTask(options: SeedanceVideoOptions): Promise<string> {
  const config = getConfig();
  const body = buildRequestBody(options, config);

  log.info("seedance", "Submitting video generation task", {
    prompt: options.prompt.slice(0, 80),
    duration: options.duration ?? 5,
    resolution: options.resolution ?? "720p",
    hasFirstFrame: !!options.firstFrameBase64,
    hasLastFrame: !!options.lastFrameBase64,
  });

  const response = await fetch(
    `${config.baseUrl}/api/v3/contents/generations/tasks`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    log.error("seedance", `Submit failed (${response.status})`, { body: errText });
    throw new Error(`Seedance submit failed (${response.status}): ${errText}`);
  }

  const result = (await response.json()) as { data?: { task_id?: string }; task_id?: string };
  const taskId = result.data?.task_id ?? result.task_id;

  if (!taskId) {
    throw new Error("Seedance submit response missing task_id");
  }

  log.info("seedance", `Task submitted: ${taskId}`);
  return taskId;
}

/**
 * Poll a task until it completes or fails.
 */
export async function pollTask(
  taskId: string,
  onProgress?: (info: SeedanceProgressInfo) => void,
  options?: { pollIntervalMs?: number; maxWaitMs?: number },
): Promise<SeedanceTaskResult> {
  const config = getConfig();
  const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxWait = options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;

  let elapsed = 0;
  let pollCount = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;
    pollCount++;

    const response = await fetch(
      `${config.baseUrl}/api/v3/contents/generations/tasks/${taskId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      log.warn("seedance", `Poll request failed (${response.status})`, { errText });
      // Continue polling on transient errors
      continue;
    }

    const result = (await response.json()) as {
      data?: {
        status?: string;
        video_url?: string;
        last_frame?: string;
        output?: { video_url?: string; last_frame?: string };
        error?: string;
      };
      status?: string;
    };

    const taskData: {
      status?: string;
      video_url?: string;
      last_frame?: string;
      output?: { video_url?: string; last_frame?: string };
      error?: string;
    } = result.data ?? { status: result.status };
    const apiStatus = (taskData.status ?? "processing") as string;
    const status = mapApiStatus(apiStatus);
    const percent = estimatePercent(status, elapsed, maxWait);

    log.debug("seedance", `Poll #${pollCount} for ${taskId}`, {
      status,
      percent: Math.round(percent),
      elapsed,
    });

    onProgress?.({ status, percent });

    if (status === "complete") {
      const videoUrl =
        taskData.video_url ??
        taskData.output?.video_url ??
        "";

      if (!videoUrl) {
        throw new Error(`Task ${taskId} completed but no video_url found`);
      }

      const lastFrame =
        taskData.last_frame ??
        taskData.output?.last_frame ??
        undefined;

      log.info("seedance", `Task ${taskId} complete`, {
        elapsed,
        pollCount,
        hasLastFrame: !!lastFrame,
      });

      return { taskId, videoUrl, lastFrameBase64: lastFrame };
    }

    if (status === "failed") {
      const errorMsg = taskData.error ?? "Unknown error";
      throw new Error(`Seedance task ${taskId} failed: ${errorMsg}`);
    }
  }

  throw new Error(`Seedance task ${taskId} timed out after ${maxWait}ms`);
}

/**
 * Generate a video end-to-end: submit + poll until complete.
 */
export async function generateVideo(
  options: SeedanceVideoOptions,
  onProgress?: (info: SeedanceProgressInfo) => void,
  pollOptions?: { pollIntervalMs?: number; maxWaitMs?: number },
): Promise<SeedanceTaskResult> {
  const taskId = await submitTask(options);
  return pollTask(taskId, onProgress, pollOptions);
}

// ─── Export helpers for testing ─────────────────────────────────────────────

export const _internals = {
  getConfig,
  buildRequestBody,
  mapApiStatus,
  estimatePercent,
};
