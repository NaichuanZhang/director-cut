import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockRuntime } from "@/lib/bedrock";
import { MODELS, DEFAULT_NUM_SCENES } from "@/lib/constants";
import { log } from "@/lib/logger";

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
  log.info("generate_script", `Generating ${numScenes} scenes`, {
    model: MODELS.SCRIPT,
    descriptionLength: description.length,
  });

  const command = new ConverseCommand({
    modelId: MODELS.SCRIPT,
    messages: [
      {
        role: "user",
        content: [
          {
            text: `Generate exactly ${numScenes} cinematic scenes for this story concept: "${description}".

For each scene, provide:
- title: A short, evocative scene title
- narrationText: 1-2 sentences of narration that would be spoken as voiceover
- visualDescription: Detailed visual description for image generation — include art style, lighting, colors, composition, character appearances
- dialogueDirections: Detailed audio directions for video generation — include any character dialogue (with emotion/tone), sound effects, ambient sounds, and music cues

Make the scenes flow as a cohesive narrative with a clear beginning, middle, and end.`,
          },
        ],
      },
    ],
    system: [{ text: "You are a screenplay writer." }],
    toolConfig: {
      tools: [
        {
          toolSpec: {
            name: "return_script",
            description: "Return the generated script",
            inputSchema: {
              json: {
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
          },
        },
      ],
      toolChoice: { tool: { name: "return_script" } },
    },
  });

  const response = await bedrockRuntime.send(command);
  const content = response.output?.message?.content ?? [];
  const toolUseBlock = content.find((b) => b.toolUse);

  if (!toolUseBlock?.toolUse?.input) {
    log.error("generate_script", "No tool_use block in response", {
      contentLength: content.length,
      stopReason: response.stopReason,
    });
    throw new Error("Script generation failed — no structured output");
  }

  const input = toolUseBlock.toolUse.input as { scenes?: ScriptScene[] };
  const scenes: readonly ScriptScene[] = input.scenes ?? [];

  log.info("generate_script", `Generated ${scenes.length} scenes`, {
    titles: scenes.map((s) => s.title),
  });

  return { scenes };
}
