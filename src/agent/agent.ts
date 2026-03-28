import type { Content, Part } from "@google/genai";
import { ai } from "@/lib/gemini";
import { MODELS, MAX_TOOL_ROUNDS } from "@/lib/constants";
import { SYSTEM_PROMPT } from "./system-prompt";
import { functionDeclarations, executeTool } from "./tools";
import type { SSEEvent } from "@/lib/types";

export async function* streamAgent(
  input: { type: "audio" | "text"; data: string },
  history: readonly Content[],
): AsyncGenerator<SSEEvent> {
  const contents: Content[] = [...history];

  // Add user input — audio or text
  if (input.type === "audio") {
    contents.push({
      role: "user",
      parts: [{ inlineData: { data: input.data, mimeType: "audio/webm" } }],
    });
  } else {
    contents.push({ role: "user", parts: [{ text: input.data }] });
  }

  const config = {
    tools: [{ functionDeclarations }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await ai.models.generateContent({
      model: MODELS.AGENT,
      contents,
      config,
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content) break;

    // Push model response to conversation for next round
    contents.push(candidate.content);

    // Yield text parts
    for (const part of candidate.content.parts ?? []) {
      if (part.text) {
        yield { type: "agent_text", text: part.text };
      }
    }

    // Check for function calls
    const calls = response.functionCalls;
    if (!calls || calls.length === 0) break;

    // Execute each function call, collect responses
    const responseParts: Part[] = [];

    for (const call of calls) {
      yield {
        type: "tool_start",
        name: call.name,
        args: call.args,
        sceneId: (call.args as Record<string, unknown>)?.scene_id,
      };

      try {
        const result = await executeTool(
          call.name ?? "",
          (call.args as Record<string, unknown>) ?? {},
          (sceneId: string, pct: number) => {
            // Note: can't yield from a callback in a generator
            // Progress events are handled via the SSE writer in the route
          },
        );

        yield {
          type: "tool_done",
          name: call.name,
          result,
          sceneId: (call.args as Record<string, unknown>)?.scene_id,
        };

        responseParts.push({
          functionResponse: {
            name: call.name,
            response: { result: JSON.stringify(result) },
            id: call.id ?? undefined,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        yield {
          type: "tool_done",
          name: call.name,
          result: { error: message },
          sceneId: (call.args as Record<string, unknown>)?.scene_id,
        };

        responseParts.push({
          functionResponse: {
            name: call.name,
            response: { error: message },
            id: call.id ?? undefined,
          },
        });
      }
    }

    // Feed function results back to Gemini for next round
    contents.push({ role: "user", parts: responseParts });
  }

  yield { type: "agent_done" };
}
