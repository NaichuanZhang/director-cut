import type { ToolConfiguration } from "@aws-sdk/client-bedrock-runtime";
import { generateScript } from "./generate-script";
import { generateImage } from "./generate-image";
import { generateVideo } from "./generate-video";

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
          "Generate a cinematic video clip from a scene description. Call after generate_image.",
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
            required: [
              "scene_id",
              "visual_description",
              "dialogue_directions",
            ],
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
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
