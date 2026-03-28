import { ai } from "@/lib/gemini";
import { MODELS, DEFAULT_NUM_SCENES } from "@/lib/constants";

interface ScriptScene {
  readonly title: string;
  readonly narrationText: string;
  readonly visualDescription: string;
  readonly dialogueDirections: string;
}

export async function generateScript(
  description: string,
  numScenes: number = DEFAULT_NUM_SCENES,
): Promise<{ scenes: readonly ScriptScene[] }> {
  const response = await ai.models.generateContent({
    model: MODELS.SCRIPT,
    contents: `Generate exactly ${numScenes} cinematic scenes for this story concept: "${description}".

For each scene, provide:
- title: A short, evocative scene title
- narrationText: 1-2 sentences of narration that would be spoken as voiceover
- visualDescription: Detailed visual description for image generation — include art style, lighting, colors, composition, character appearances
- dialogueDirections: Detailed audio directions for video generation — include any character dialogue (with emotion/tone), sound effects, ambient sounds, and music cues

Make the scenes flow as a cohesive narrative with a clear beginning, middle, and end.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          scenes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                narrationText: { type: "string" },
                visualDescription: { type: "string" },
                dialogueDirections: { type: "string" },
              },
              required: [
                "title",
                "narrationText",
                "visualDescription",
                "dialogueDirections",
              ],
            },
          },
        },
        required: ["scenes"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}");
  return { scenes: parsed.scenes ?? [] };
}
