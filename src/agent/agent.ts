import type { Content, GenerateContentResponse, Part } from "@google/genai";
import { ai } from "@/lib/gemini";
import { MODELS, MAX_TOOL_ROUNDS } from "@/lib/constants";
import { SYSTEM_PROMPT } from "./system-prompt";
import { functionDeclarations, executeTool } from "./tools";
import { log } from "@/lib/logger";
import type { SSEEvent } from "@/lib/types";

const RETRY_CODES = new Set([429, 503]);
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2_000;

async function generateContentWithRetry(
  ...args: Parameters<typeof ai.models.generateContent>
): Promise<GenerateContentResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai.models.generateContent(...args);
    } catch (error) {
      const status = parseStatusCode(error);
      if (
        status === null ||
        !RETRY_CODES.has(status) ||
        attempt >= MAX_RETRIES
      ) {
        throw error;
      }
      const delayMs = RETRY_BASE_MS * 2 ** attempt;
      log.warn(
        "agent",
        `Gemini ${status} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

function parseStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/"code"\s*:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Strip base64 data URIs from tool results before feeding back to Gemini. */
function summarizeForLLM(result: unknown): unknown {
  if (typeof result !== "object" || result === null) return result;
  const rec = result as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === "string" && v.startsWith("data:")) {
      out[k] = v.slice(0, v.indexOf(",") + 1) + "…";
    } else {
      out[k] = v;
    }
  }
  return out;
}

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

    const response = await generateContentWithRetry({
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
            response: { result: JSON.stringify(summarizeForLLM(result)) },
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
