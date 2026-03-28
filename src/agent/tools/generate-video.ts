import { ai } from "@/lib/gemini";
import {
  MODELS,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_MAX_WAIT_MS,
  VIDEO_DURATION_SECONDS,
  VIDEO_RESOLUTION,
  VIDEO_ASPECT_RATIO,
} from "@/lib/constants";
import { log } from "@/lib/logger";

export async function generateVideo(
  sceneId: string,
  visualDescription: string,
  dialogueDirections: string,
  onProgress?: (sceneId: string, pct: number) => void,
): Promise<{ sceneId: string; videoUrl: string }> {
  const fullPrompt = `${visualDescription}. Audio directions: ${dialogueDirections}`;

  log.info("generate_video", `Starting video generation for ${sceneId}`, {
    model: MODELS.VIDEO,
    promptLength: fullPrompt.length,
    durationSeconds: VIDEO_DURATION_SECONDS,
    resolution: VIDEO_RESOLUTION,
    aspectRatio: VIDEO_ASPECT_RATIO,
  });

  let operation = await ai.models.generateVideos({
    model: MODELS.VIDEO,
    prompt: fullPrompt,
    config: {
      aspectRatio: VIDEO_ASPECT_RATIO,
      resolution: VIDEO_RESOLUTION,
      durationSeconds: VIDEO_DURATION_SECONDS,
    },
  });

  log.debug("generate_video", `Initial operation for ${sceneId}`, {
    done: operation.done,
    operationName: operation.name,
  });

  // Poll until done — Veo is async
  let elapsed = 0;
  let pollCount = 0;

  while (!operation.done && elapsed < VIDEO_MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
    elapsed += VIDEO_POLL_INTERVAL_MS;
    pollCount++;

    const pct = Math.min((elapsed / VIDEO_MAX_WAIT_MS) * 100, 95);
    onProgress?.(sceneId, pct);

    log.debug("generate_video", `Polling ${sceneId} — attempt ${pollCount}`, {
      elapsedMs: elapsed,
      pct: Math.round(pct),
    });

    operation = await ai.operations.getVideosOperation({ operation });
  }

  if (!operation.done) {
    log.error("generate_video", `Timed out for ${sceneId}`, {
      elapsedMs: elapsed,
      pollCount,
      maxWaitMs: VIDEO_MAX_WAIT_MS,
    });
    throw new Error(`Video generation timed out for scene ${sceneId}`);
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video?.uri) {
    log.error("generate_video", `No video URI in response for ${sceneId}`, {
      hasResponse: !!operation.response,
      videoCount: operation.response?.generatedVideos?.length ?? 0,
    });
    throw new Error(`No video URL returned for scene ${sceneId}`);
  }

  log.info("generate_video", `Video ready for ${sceneId}`, {
    elapsedMs: elapsed,
    pollCount,
    uri: video.uri,
  });

  return { sceneId, videoUrl: video.uri };
}
