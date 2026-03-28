import { ai } from "@/lib/gemini";
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

  const response = await ai.models.generateImages({
    model: MODELS.IMAGE,
    prompt: visualDescription,
    config: {
      numberOfImages: 1,
    },
  });

  const imageCount = response.generatedImages?.length ?? 0;
  log.debug("generate_image", `Response received for ${sceneId}`, {
    imageCount,
  });

  const image = response.generatedImages?.[0];
  if (!image?.image?.imageBytes) {
    log.error("generate_image", `No image bytes in response for ${sceneId}`, {
      imageCount,
      hasImage: !!image,
      hasImageObj: !!image?.image,
    });
    throw new Error(`Image generation failed for scene ${sceneId}`);
  }

  const base64 = Buffer.from(image.image.imageBytes).toString("base64");
  log.info("generate_image", `Image ready for ${sceneId}`, {
    sizeKB: Math.round((base64.length * 0.75) / 1024),
  });

  return {
    sceneId,
    imageUrl: `data:image/png;base64,${base64}`,
  };
}
