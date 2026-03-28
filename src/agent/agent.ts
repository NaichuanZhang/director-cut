import type { Content, Part } from "@google/genai";
import { ai } from "@/lib/gemini";
import { MODELS, MAX_TOOL_ROUNDS } from "@/lib/constants";
import { SYSTEM_PROMPT } from "./system-prompt";
import { functionDeclarations, executeTool } from "./tools";
import { log } from "@/lib/logger";
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

  log.info(
    "agent",
    `Starting agent loop — input.type=${input.type}, historyLength=${history.length}`,
  );

  const config = {
    tools: [{ functionDeclarations }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    log.debug(
      "agent",
      `Round ${round + 1}/${MAX_TOOL_ROUNDS} — calling Gemini`,
      {
        model: MODELS.AGENT,
        contentsLength: contents.length,
      },
    );

    const response = await ai.models.generateContent({
      model: MODELS.AGENT,
      contents,
      config,
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content) {
      log.warn(
        "agent",
        `Round ${round + 1} — no candidate content, ending loop`,
        {
          candidatesCount: response.candidates?.length ?? 0,
          finishReason: candidate?.finishReason,
        },
      );
      break;
    }

    log.debug("agent", `Round ${round + 1} — response received`, {
      partsCount: candidate.content.parts?.length ?? 0,
      finishReason: candidate.finishReason,
    });

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
    if (!calls || calls.length === 0) {
      log.info("agent", `Round ${round + 1} — no function calls, ending loop`);
      break;
    }

    log.info("agent", `Round ${round + 1} — ${calls.length} tool call(s)`, {
      tools: calls.map((c) => c.name),
    });

    // Execute each function call, collect responses
    const responseParts: Part[] = [];

    for (const call of calls) {
      const sceneId = (call.args as Record<string, unknown>)?.scene_id;

      yield {
        type: "tool_start",
        name: call.name,
        args: call.args,
        sceneId,
      };

      const startMs = Date.now();

      try {
        log.debug("agent", `Executing tool: ${call.name}`, {
          sceneId,
          args: call.args,
        });

        const result = await executeTool(
          call.name ?? "",
          (call.args as Record<string, unknown>) ?? {},
          (sid: string, pct: number) => {
            // Note: can't yield from a callback in a generator
            // Progress events are handled via the SSE writer in the route
          },
        );

        const durationMs = Date.now() - startMs;
        log.info("agent", `Tool ${call.name} completed in ${durationMs}ms`, {
          sceneId,
        });

        yield {
          type: "tool_done",
          name: call.name,
          result,
          sceneId,
        };

        responseParts.push({
          functionResponse: {
            name: call.name,
            response: { result: JSON.stringify(result) },
            id: call.id ?? undefined,
          },
        });
      } catch (error) {
        const durationMs = Date.now() - startMs;
        const message =
          error instanceof Error ? error.message : "Unknown error";

        log.error(
          "agent",
          `Tool ${call.name} FAILED after ${durationMs}ms`,
          error,
        );

        yield {
          type: "tool_done",
          name: call.name,
          result: { error: message },
          sceneId,
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

  log.info("agent", "Agent loop finished");
  yield { type: "agent_done" };
}
