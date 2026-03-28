import { NextRequest } from "next/server";
import { streamAgent } from "@/agent/agent";
import { log } from "@/lib/logger";

export const maxDuration = 300; // 5 min — video gen can be slow

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = body.input as { type: "audio" | "text"; data: string };

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
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamAgent(input, [])) {
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
