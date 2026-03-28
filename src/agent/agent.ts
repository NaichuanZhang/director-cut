import {
  ConverseCommand,
  ThrottlingException,
  ServiceUnavailableException,
  ModelTimeoutException,
  type Message,
  type ContentBlock,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { bedrockRuntime } from "@/lib/bedrock";
import { MODELS, MAX_TOOL_ROUNDS } from "@/lib/constants";
import { SYSTEM_PROMPT } from "./system-prompt";
import { toolConfig, executeTool } from "./tools";
import { log } from "@/lib/logger";
import type { SSEEvent } from "@/lib/types";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2_000;

async function converseWithRetry(
  command: ConverseCommand,
): Promise<ConverseCommandOutput> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await bedrockRuntime.send(command);
    } catch (error) {
      const isRetryable =
        error instanceof ThrottlingException ||
        error instanceof ServiceUnavailableException ||
        error instanceof ModelTimeoutException;

      if (!isRetryable || attempt >= MAX_RETRIES) {
        throw error;
      }

      const delayMs = RETRY_BASE_MS * 2 ** attempt;
      log.warn(
        "agent",
        `Bedrock error — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Strip base64 data URIs from tool results before feeding back to the model. */
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
  history: readonly Message[],
): AsyncGenerator<SSEEvent> {
  const messages: Message[] = [...history];

  // Add user input — text only (audio transcribed client-side)
  messages.push({
    role: "user",
    content: [{ text: input.data }],
  });

  log.info(
    "agent",
    `Starting agent loop — input.type=${input.type}, historyLength=${history.length}`,
  );

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    log.debug(
      "agent",
      `Round ${round + 1}/${MAX_TOOL_ROUNDS} — calling Bedrock`,
      {
        model: MODELS.AGENT,
        messagesLength: messages.length,
      },
    );

    const command = new ConverseCommand({
      modelId: MODELS.AGENT,
      messages,
      system: [{ text: SYSTEM_PROMPT }],
      toolConfig,
    });

    const response = await converseWithRetry(command);

    const assistantMessage = response.output?.message;
    if (!assistantMessage?.content) {
      log.warn(
        "agent",
        `Round ${round + 1} — no assistant content, ending loop`,
        { stopReason: response.stopReason },
      );
      break;
    }

    log.debug("agent", `Round ${round + 1} — response received`, {
      blocksCount: assistantMessage.content.length,
      stopReason: response.stopReason,
    });

    // Push assistant message to conversation for next round
    messages.push(assistantMessage);

    // Yield text blocks
    for (const block of assistantMessage.content) {
      if (block.text) {
        yield { type: "agent_text", text: block.text };
      }
    }

    // Extract tool use blocks
    const toolUseBlocks = assistantMessage.content.filter(
      (
        b,
      ): b is ContentBlock & {
        toolUse: NonNullable<ContentBlock["toolUse"]>;
      } => !!b.toolUse,
    );

    if (toolUseBlocks.length === 0) {
      log.info("agent", `Round ${round + 1} — no tool calls, ending loop`);
      break;
    }

    log.info(
      "agent",
      `Round ${round + 1} — ${toolUseBlocks.length} tool call(s)`,
      {
        tools: toolUseBlocks.map((b) => b.toolUse.name),
      },
    );

    // Emit all tool_start events, then execute tools in parallel
    const toolCalls = toolUseBlocks.map((block) => {
      const { toolUseId, name, input: toolInput } = block.toolUse;
      const args = (toolInput ?? {}) as Record<string, unknown>;
      const sceneId = args.scene_id as string | undefined;
      return { toolUseId, name: name ?? "", args, sceneId };
    });

    for (const call of toolCalls) {
      yield {
        type: "tool_start",
        name: call.name,
        args: call.args,
        sceneId: call.sceneId,
      };
    }

    // Run all tools concurrently
    const settled = await Promise.allSettled(
      toolCalls.map(async (call) => {
        const startMs = Date.now();
        log.debug("agent", `Executing tool: ${call.name}`, {
          sceneId: call.sceneId,
          args: call.args,
        });
        const result = await executeTool(call.name, call.args, () => {});
        const durationMs = Date.now() - startMs;
        log.info("agent", `Tool ${call.name} completed in ${durationMs}ms`, {
          sceneId: call.sceneId,
        });
        return result;
      }),
    );

    // Collect results and emit tool_done events
    const toolResultContent: ContentBlock[] = [];

    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      const outcome = settled[i];

      if (outcome.status === "fulfilled") {
        yield {
          type: "tool_done",
          name: call.name,
          result: outcome.value,
          sceneId: call.sceneId,
        };
        toolResultContent.push({
          toolResult: {
            toolUseId: call.toolUseId,
            content: [{ text: JSON.stringify(summarizeForLLM(outcome.value)) }],
          },
        });
      } else {
        const message =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : "Unknown error";
        log.error("agent", `Tool ${call.name} FAILED`, outcome.reason);
        yield {
          type: "tool_done",
          name: call.name,
          result: { error: message },
          sceneId: call.sceneId,
        };
        toolResultContent.push({
          toolResult: {
            toolUseId: call.toolUseId,
            content: [{ text: JSON.stringify({ error: message }) }],
            status: "error",
          },
        });
      }
    }

    // Feed tool results back as a user message
    messages.push({ role: "user", content: toolResultContent });
  }

  log.info("agent", "Agent loop finished");
  yield { type: "agent_done" };
}
