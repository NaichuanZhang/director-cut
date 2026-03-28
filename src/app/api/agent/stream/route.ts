import { NextRequest } from "next/server";
import { streamAgent } from "@/agent/agent";

export const maxDuration = 300; // 5 min — video gen can be slow

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = body.input as { type: "audio" | "text"; data: string };

  if (!input?.type || !input?.data) {
    return Response.json(
      { error: "Missing input.type or input.data" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamAgent(input, [])) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
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
