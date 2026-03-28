import { NextRequest } from "next/server";
import { streamAgent } from "@/agent/agent";
import { transcribeAudio } from "@/lib/transcribe";
import { log } from "@/lib/logger";

export const maxDuration = 300; // 5 min — video gen can be slow

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = body.input as { type: "audio" | "text"; data: string };
  const history = (body.history ?? []) as Array<{
    role: "user" | "assistant";
    content: Array<{ text: string }>;
  }>;

  if (!input?.type || !input?.data) {
    log.warn("route", "Bad request — missing input.type or input.data", {
      hasType: !!input?.type,
      hasData: !!input?.data,
    });
    return Response.json(
      { error: "Missing input.type or input.data" },
      { status: 400 },
    );
  }

  log.info("route", `POST /api/agent/stream — input.type=${input.type}`, {
    dataLength: input.data.length,
    historyLength: history.length,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Transcribe audio input before passing to agent
        let agentInput = input;
        if (input.type === "audio") {
          log.info("route", "Transcribing audio input", {
            audioSizeKB: Math.round((input.data.length * 0.75) / 1024),
          });
          const transcript = await transcribeAudio(input.data);
          agentInput = { type: "text", data: transcript };

          const transcriptionEvent = `data: ${JSON.stringify({
            type: "transcription_done",
            text: transcript,
          })}\n\n`;
          controller.enqueue(encoder.encode(transcriptionEvent));
        }

        for await (const event of streamAgent(agentInput, history)) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        log.info("route", "Stream completed successfully");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        log.error("route", "Stream failed", error);
        const data = `data: ${JSON.stringify({ type: "error", message })}\n\n`;
        controller.enqueue(encoder.encode(data));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
