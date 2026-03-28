import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockRuntime } from "@/lib/bedrock";
import { MODELS } from "@/lib/constants";
import { log } from "@/lib/logger";

export async function generateImage(
  sceneId: string,
  visualDescription: string,
): Promise<{ sceneId: string; imageUrl: string }> {
  log.info("generate_image", `Generating image for ${sceneId}`, {
    model: MODELS.IMAGE,
    promptLength: visualDescription.length,
  });

  const command = new InvokeModelCommand({
    modelId: MODELS.IMAGE,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      prompt: visualDescription,
      mode: "text-to-image",
      output_format: "png",
      aspect_ratio: "16:9",
    }),
  });

  const response = await bedrockRuntime.send(command);
  const body = JSON.parse(
    new TextDecoder().decode(response.body),
  ) as { images?: string[] };

  const base64 = body.images?.[0];
  if (!base64) {
    log.error("generate_image", `No image data in response for ${sceneId}`, {
      hasImages: !!body.images,
      imageCount: body.images?.length ?? 0,
    });
    throw new Error(`Image generation failed for scene ${sceneId}`);
  }

  log.info("generate_image", `Image ready for ${sceneId}`, {
    sizeKB: Math.round((base64.length * 0.75) / 1024),
  });

  return {
    sceneId,
    imageUrl: `data:image/png;base64,${base64}`,
  };
}
