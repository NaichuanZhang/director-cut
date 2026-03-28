import { ai } from "@/lib/gemini";
import {
  MODELS,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_MAX_WAIT_MS,
  VIDEO_DURATION_SECONDS,
  VIDEO_RESOLUTION,
  VIDEO_ASPECT_RATIO,
} from "@/lib/constants";

export async function generateVideo(
  sceneId: string,
  visualDescription: string,
  dialogueDirections: string,
  onProgress?: (sceneId: string, pct: number) => void,
): Promise<{ sceneId: string; videoUrl: string }> {
  const fullPrompt = `${visualDescription}. Audio directions: ${dialogueDirections}`;

  let operation = await ai.models.generateVideos({
    model: MODELS.VIDEO,
    prompt: fullPrompt,
    config: {
      aspectRatio: VIDEO_ASPECT_RATIO,
      resolution: VIDEO_RESOLUTION,
      durationSeconds: VIDEO_DURATION_SECONDS,
    },
  });

  // Poll until done — Veo is async
  let elapsed = 0;

  while (!operation.done && elapsed < VIDEO_MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
    elapsed += VIDEO_POLL_INTERVAL_MS;

    const pct = Math.min((elapsed / VIDEO_MAX_WAIT_MS) * 100, 95);
    onProgress?.(sceneId, pct);

    operation = await ai.operations.getVideosOperation({ operation });
  }

  if (!operation.done) {
    throw new Error(`Video generation timed out for scene ${sceneId}`);
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video?.uri) {
    throw new Error(`No video URL returned for scene ${sceneId}`);
  }

  return { sceneId, videoUrl: video.uri };
}
