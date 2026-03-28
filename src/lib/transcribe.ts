import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  type AudioEvent,
} from "@aws-sdk/client-transcribe-streaming";
import { fromIni } from "@aws-sdk/credential-providers";
import { spawn } from "child_process";
import { log } from "@/lib/logger";

const credentials = fromIni({ profile: "tokenmaster" });
const region = process.env.AWS_REGION ?? "us-west-2";

const transcribeStreaming = new TranscribeStreamingClient({
  region,
  credentials,
});

/** Convert WebM/Opus audio to PCM 16-bit LE mono 16kHz via ffmpeg. */
function webmToPcm(webmBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-i", "pipe:0",     // read from stdin
      "-f", "s16le",      // raw PCM 16-bit little-endian
      "-acodec", "pcm_s16le",
      "-ar", "16000",     // 16 kHz sample rate
      "-ac", "1",         // mono
      "pipe:1",           // write to stdout
    ], { stdio: ["pipe", "pipe", "pipe"] });

    const chunks: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-200)}`));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });

    proc.on("error", reject);
    proc.stdin.write(webmBuffer);
    proc.stdin.end();
  });
}

async function* audioStream(
  buffer: Buffer,
): AsyncGenerator<{ AudioEvent: AudioEvent }> {
  // Send in 8KB chunks for smoother streaming
  const chunkSize = 8192;
  for (let i = 0; i < buffer.byteLength; i += chunkSize) {
    yield {
      AudioEvent: {
        AudioChunk: buffer.subarray(i, Math.min(i + chunkSize, buffer.byteLength)),
      },
    };
  }
}

export async function transcribeAudio(base64Audio: string): Promise<string> {
  const webmBuffer = Buffer.from(base64Audio, "base64");

  log.info("transcribe", "Starting transcription", {
    audioSizeKB: Math.round(webmBuffer.byteLength / 1024),
  });

  const pcmBuffer = await webmToPcm(webmBuffer);

  log.debug("transcribe", "Converted WebM to PCM", {
    pcmSizeKB: Math.round(pcmBuffer.byteLength / 1024),
  });

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaEncoding: "pcm",
    MediaSampleRateHertz: 16000,
    AudioStream: audioStream(pcmBuffer),
  });

  const response = await transcribeStreaming.send(command);
  const segments: string[] = [];

  if (response.TranscriptResultStream) {
    for await (const event of response.TranscriptResultStream) {
      const results = event.TranscriptEvent?.Transcript?.Results;
      if (!results) continue;
      for (const result of results) {
        if (!result.IsPartial) {
          const text = result.Alternatives?.[0]?.Transcript;
          if (text) segments.push(text);
        }
      }
    }
  }

  const fullTranscript = segments.join(" ").trim();

  log.info("transcribe", "Transcription complete", {
    transcriptLength: fullTranscript.length,
    preview: fullTranscript.slice(0, 100),
  });

  if (!fullTranscript) {
    throw new Error("Transcription returned empty — no speech detected");
  }

  return fullTranscript;
}
