import { Type, type FunctionDeclaration } from "@google/genai";
import { generateScript } from "./generate-script";
import { generateImage } from "./generate-image";
import { generateVideo } from "./generate-video";
import { generateSpeech } from "./generate-speech";

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "generate_script",
    description:
      "Generate a structured script with scenes from a story description. Always call this first.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description: "The story/movie description from the user",
        },
        num_scenes: {
          type: Type.NUMBER,
          description: "Number of scenes to generate (default 3)",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "generate_image",
    description:
      "Generate a keyframe image for a scene. Call after generate_script, once per scene.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scene_id: {
          type: Type.STRING,
          description: "The scene ID to generate an image for",
        },
        visual_description: {
          type: Type.STRING,
          description:
            "Detailed visual description of the scene — style, composition, lighting, colors, characters",
        },
      },
      required: ["scene_id", "visual_description"],
    },
  },
  {
    name: "generate_video",
    description:
      "Generate a cinematic video clip with native audio from a keyframe image. Call after generate_image. Veo 3.1 generates dialogue, sound effects, and ambient audio automatically.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scene_id: {
          type: Type.STRING,
          description: "The scene ID",
        },
        visual_description: {
          type: Type.STRING,
          description:
            "What happens visually — camera movement, character actions, transitions",
        },
        dialogue_directions: {
          type: Type.STRING,
          description:
            "Detailed audio directions: character dialogue with tone/emotion, sound effects, ambient sounds. Example: 'Character whispers \"hello\" softly. Wind howling. Distant thunder.'",
        },
      },
      required: ["scene_id", "visual_description", "dialogue_directions"],
    },
  },
  {
    name: "generate_speech",
    description:
      "Generate narration audio for a scene. Only use as fallback when generate_video fails or times out.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scene_id: {
          type: Type.STRING,
          description: "The scene ID",
        },
        text: {
          type: Type.STRING,
          description: "The narration text to speak",
        },
      },
      required: ["scene_id", "text"],
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  onProgress?: (sceneId: string, pct: number) => void,
): Promise<unknown> {
  switch (name) {
    case "generate_script":
      return generateScript(
        args.description as string,
        (args.num_scenes as number) ?? 3,
      );
    case "generate_image":
      return generateImage(
        args.scene_id as string,
        args.visual_description as string,
      );
    case "generate_video":
      return generateVideo(
        args.scene_id as string,
        args.visual_description as string,
        args.dialogue_directions as string,
        onProgress,
      );
    case "generate_speech":
      return generateSpeech(args.scene_id as string, args.text as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
