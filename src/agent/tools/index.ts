import type { ToolConfiguration } from "@aws-sdk/client-bedrock-runtime";
import { generateScript } from "./generate-script";
import { generateImage } from "./generate-image";
import { generateVideo } from "./generate-video";
import { generateSpeech } from "./generate-speech";
import { clearChainStore } from "@/lib/scene-chaining";
import {
  type DirectorSettings,
  DEFAULT_DIRECTOR_SETTINGS,
} from "@/lib/director-controls";

/** Server-side cache of generated keyframe images (sceneId → base64 PNG). */
const imageCache = new Map<string, string>();

/** Ordered list of scene IDs for chaining context. */
let sceneOrder: string[] = [];

/** Current director settings (can be updated mid-session). */
let currentSettings: DirectorSettings = DEFAULT_DIRECTOR_SETTINGS;

export function clearImageCache(): void {
  imageCache.clear();
  clearChainStore();
  sceneOrder = [];
}

export function setDirectorSettings(settings: DirectorSettings): void {
  currentSettings = settings;
}

export function getDirectorSettings(): DirectorSettings {
  return currentSettings;
}

export function setSceneOrder(ids: string[]): void {
  sceneOrder = ids;
}

export const toolConfig: ToolConfiguration = {
  tools: [
    {
      toolSpec: {
        name: "generate_script",
        description:
          "Generate a structured script with scenes from a story description. Always call this first.",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "The story/movie description from the user",
              },
              num_scenes: {
                type: "number",
                description: "Number of scenes to generate (default 3)",
              },
            },
            required: ["description"],
          },
        },
      },
    },
    {
      toolSpec: {
        name: "generate_image",
        description:
          "Generate a keyframe image for a scene. Call after generate_script, once per scene.",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              scene_id: {
                type: "string",
                description: "The scene ID to generate an image for",
              },
              visual_description: {
                type: "string",
                description:
                  "Detailed visual description of the scene — style, composition, lighting, colors, characters",
              },
            },
            required: ["scene_id", "visual_description"],
          },
        },
      },
    },
    {
      toolSpec: {
        name: "generate_video",
        description:
          "Generate a cinematic video clip from a scene description using Seedance 2.0. Call after generate_image. Supports scene chaining for visual continuity.",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              scene_id: {
                type: "string",
                description: "The scene ID",
              },
              visual_description: {
                type: "string",
                description:
                  "What happens visually — camera movement, character actions, transitions",
              },
              dialogue_directions: {
                type: "string",
                description:
                  "Detailed audio directions: character dialogue with tone/emotion, sound effects, ambient sounds. Example: 'Character whispers \"hello\" softly. Wind howling. Distant thunder.'",
              },
            },
            required: ["scene_id", "visual_description", "dialogue_directions"],
          },
        },
      },
    },
    {
      toolSpec: {
        name: "generate_speech",
        description:
          "Generate narration audio for a scene. Call alongside generate_image in the same round, once per scene.",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              scene_id: {
                type: "string",
                description: "The scene ID",
              },
              text: {
                type: "string",
                description: "The narration text to speak",
              },
            },
            required: ["scene_id", "text"],
          },
        },
      },
    },
  ],
};

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  onProgress?: (sceneId: string, pct: number) => void,
): Promise<unknown> {
  switch (name) {
    case "generate_script": {
      const result = await generateScript(
        args.description as string,
        (args.num_scenes as number) ?? 3,
      );
      // Track scene order for chaining
      const scenes = (result as unknown as { scenes: { title: string }[] }).scenes;
      if (scenes) {
        sceneOrder = scenes.map((_, i) => `scene-${i}`);
      }
      return result;
    }
    case "generate_image": {
      const result = await generateImage(
        args.scene_id as string,
        args.visual_description as string,
      );
      // Cache the base64 image for later video generation
      const imageResult = result as { sceneId: string; imageUrl: string };
      const prefix = "data:image/png;base64,";
      if (imageResult.imageUrl.startsWith(prefix)) {
        imageCache.set(
          imageResult.sceneId,
          imageResult.imageUrl.slice(prefix.length),
        );
      }
      return result;
    }
    case "generate_video": {
      const sceneId = args.scene_id as string;
      const sceneIndex = sceneOrder.indexOf(sceneId);

      return generateVideo(
        sceneId,
        args.visual_description as string,
        args.dialogue_directions as string,
        onProgress,
        imageCache.get(sceneId),
        sceneIndex >= 0 ? sceneIndex : undefined,
        sceneOrder,
        currentSettings,
      );
    }
    case "generate_speech":
      return generateSpeech(args.scene_id as string, args.text as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
