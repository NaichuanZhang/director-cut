import { log } from "@/lib/logger";

const BASE_URL = "https://inference.do-ai.run/v1";
const TTS_MODEL = "fal-ai/elevenlabs/tts/multilingual-v2";
const TTS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 60_000;

function getApiKey(): string {
  const key = process.env.DIGITAL_OCEAN_MODEL_ACCESS_KEY;
  if (!key) throw new Error("DIGITAL_OCEAN_MODEL_ACCESS_KEY not configured");
  return key;
}

export async function generateSpeech(
  sceneId: string,
  text: string,
): Promise<{ sceneId: string; audioUrl: string }> {
  const apiKey = getApiKey();
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  log.info("generate_speech", `Generating speech for ${sceneId}`, {
    model: TTS_MODEL,
    textLength: text.length,
  });

  // Step 1: Submit async TTS request
  const submitRes = await fetch(`${BASE_URL}/async-invoke`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model_id: TTS_MODEL,
      input: {
        text,
        voice_id: TTS_VOICE_ID,
      },
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`TTS submit failed (${submitRes.status}): ${body}`);
  }

  const { request_id } = (await submitRes.json()) as { request_id: string };

  log.debug("generate_speech", `Async request submitted for ${sceneId}`, {
    requestId: request_id,
  });

  // Step 2: Poll until completed
  let elapsed = 0;

  while (elapsed < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    elapsed += POLL_INTERVAL_MS;

    const statusRes = await fetch(
      `${BASE_URL}/async-invoke/${request_id}/status`,
      { headers },
    );
    const statusBody = (await statusRes.json()) as { status: string };

    if (statusBody.status === "COMPLETED") {
      break;
    }

    if (
      statusBody.status !== "QUEUED" &&
      statusBody.status !== "IN_PROGRESS"
    ) {
      throw new Error(
        `TTS failed for scene ${sceneId}: status=${statusBody.status}`,
      );
    }

    log.debug("generate_speech", `Polling ${sceneId}`, {
      status: statusBody.status,
      elapsedMs: elapsed,
    });
  }

  if (elapsed >= MAX_WAIT_MS) {
    throw new Error(`TTS timed out for scene ${sceneId}`);
  }

  // Step 3: Retrieve result
  const resultRes = await fetch(
    `${BASE_URL}/async-invoke/${request_id}`,
    { headers },
  );

  if (!resultRes.ok) {
    const body = await resultRes.text();
    throw new Error(`TTS retrieve failed (${resultRes.status}): ${body}`);
  }

  const result = (await resultRes.json()) as {
    output?: { audio?: { url?: string }; audio_url?: string };
  };

  // ElevenLabs returns audio URL — download and convert to base64
  const audioUrl =
    result.output?.audio?.url ?? result.output?.audio_url;

  if (!audioUrl) {
    log.error("generate_speech", `No audio URL in response for ${sceneId}`, {
      resultKeys: Object.keys(result),
      outputKeys: result.output ? Object.keys(result.output) : [],
    });
    throw new Error(`No audio returned for scene ${sceneId}`);
  }

  const audioRes = await fetch(audioUrl);
  const audioBuffer = await audioRes.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString("base64");

  // Detect content type from response or default to mp3
  const contentType = audioRes.headers.get("content-type") ?? "audio/mpeg";

  log.info("generate_speech", `Speech ready for ${sceneId}`, {
    sizeKB: Math.round(audioBuffer.byteLength / 1024),
    contentType,
  });

  return {
    sceneId,
    audioUrl: `data:${contentType};base64,${base64}`,
  };
}
