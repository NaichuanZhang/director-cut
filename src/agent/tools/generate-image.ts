import { ai } from "@/lib/gemini";
import { MODELS } from "@/lib/constants";

export async function generateImage(
  sceneId: string,
  visualDescription: string,
): Promise<{ sceneId: string; imageUrl: string }> {
  const response = await ai.models.generateImages({
    model: MODELS.IMAGE,
    prompt: visualDescription,
    config: {
      numberOfImages: 1,
    },
  });

  const image = response.generatedImages?.[0];
  if (!image?.image?.imageBytes) {
    throw new Error(`Image generation failed for scene ${sceneId}`);
  }

  const base64 = Buffer.from(image.image.imageBytes).toString("base64");
  return {
    sceneId,
    imageUrl: `data:image/png;base64,${base64}`,
  };
}
