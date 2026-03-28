import {
  StartAsyncInvokeCommand,
  GetAsyncInvokeCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { bedrockRuntime, s3 } from "@/lib/bedrock";
import {
  MODELS,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_MAX_WAIT_MS,
  VIDEO_OUTPUT_S3_BUCKET,
  VIDEO_OUTPUT_S3_PREFIX,
} from "@/lib/constants";
import { log } from "@/lib/logger";

export async function generateVideo(
  sceneId: string,
  visualDescription: string,
  dialogueDirections: string,
  onProgress?: (sceneId: string, pct: number) => void,
): Promise<{ sceneId: string; videoUrl: string }> {
  const fullPrompt = `${visualDescription}. Audio directions: ${dialogueDirections}`;
  const outputKey = `${VIDEO_OUTPUT_S3_PREFIX}${sceneId}-${Date.now()}`;

  log.info("generate_video", `Starting video generation for ${sceneId}`, {
    model: MODELS.VIDEO,
    promptLength: fullPrompt.length,
    s3Bucket: VIDEO_OUTPUT_S3_BUCKET,
    s3Key: outputKey,
  });

  const startCommand = new StartAsyncInvokeCommand({
    modelId: MODELS.VIDEO,
    modelInput: {
      prompt: fullPrompt,
    },
    outputDataConfig: {
      s3OutputDataConfig: {
        s3Uri: `s3://${VIDEO_OUTPUT_S3_BUCKET}/${outputKey}`,
      },
    },
  });

  const startResponse = await bedrockRuntime.send(startCommand);
  const invocationArn = startResponse.invocationArn;

  if (!invocationArn) {
    throw new Error(`Failed to start video generation for scene ${sceneId}`);
  }

  log.debug("generate_video", `Async invocation started for ${sceneId}`, {
    invocationArn,
  });

  // Poll until done
  let elapsed = 0;
  let pollCount = 0;

  while (elapsed < VIDEO_MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
    elapsed += VIDEO_POLL_INTERVAL_MS;
    pollCount++;

    const pct = Math.min((elapsed / VIDEO_MAX_WAIT_MS) * 100, 95);
    onProgress?.(sceneId, pct);

    log.debug("generate_video", `Polling ${sceneId} — attempt ${pollCount}`, {
      elapsedMs: elapsed,
      pct: Math.round(pct),
    });

    const getCommand = new GetAsyncInvokeCommand({ invocationArn });
    const getResponse = await bedrockRuntime.send(getCommand);

    if (getResponse.status === "Completed") {
      const outputS3Uri =
        getResponse.outputDataConfig?.s3OutputDataConfig?.s3Uri;
      if (!outputS3Uri) {
        throw new Error(`No output URI for video ${sceneId}`);
      }

      // Download video from S3 and convert to base64 data URI
      const videoKey = `${parseS3Key(outputS3Uri)}/output.mp4`;
      const videoBucket = parseS3Bucket(outputS3Uri);

      log.debug("generate_video", `Downloading video for ${sceneId}`, {
        bucket: videoBucket,
        key: videoKey,
      });

      const getObj = await s3.send(
        new GetObjectCommand({ Bucket: videoBucket, Key: videoKey }),
      );
      const bytes = await getObj.Body!.transformToByteArray();
      const base64 = Buffer.from(bytes).toString("base64");

      log.info("generate_video", `Video ready for ${sceneId}`, {
        elapsedMs: elapsed,
        pollCount,
        sizeKB: Math.round(bytes.length / 1024),
      });

      // Clean up S3 objects after download
      await deleteS3Prefix(videoBucket, parseS3Key(outputS3Uri));

      return { sceneId, videoUrl: `data:video/mp4;base64,${base64}` };
    }

    if (getResponse.status === "Failed") {
      log.error("generate_video", `Failed for ${sceneId}`, {
        failureMessage: getResponse.failureMessage,
      });
      throw new Error(
        `Video generation failed for scene ${sceneId}: ${getResponse.failureMessage ?? "unknown error"}`,
      );
    }
  }

  log.error("generate_video", `Timed out for ${sceneId}`, {
    elapsedMs: elapsed,
    pollCount,
    maxWaitMs: VIDEO_MAX_WAIT_MS,
  });
  throw new Error(`Video generation timed out for scene ${sceneId}`);
}

function parseS3Bucket(s3Uri: string): string {
  const match = s3Uri.match(/^s3:\/\/([^/]+)/);
  if (!match) throw new Error(`Invalid S3 URI: ${s3Uri}`);
  return match[1];
}

function parseS3Key(s3Uri: string): string {
  const match = s3Uri.match(/^s3:\/\/[^/]+\/(.+)$/);
  if (!match) throw new Error(`Invalid S3 URI: ${s3Uri}`);
  return match[1];
}

async function deleteS3Prefix(bucket: string, prefix: string): Promise<void> {
  try {
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
    );
    const objects = listed.Contents;
    if (!objects || objects.length === 0) return;

    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects.map((o) => ({ Key: o.Key })) },
      }),
    );
    log.debug("generate_video", `Cleaned up ${objects.length} S3 objects`, {
      prefix,
    });
  } catch (error) {
    // Non-fatal — log and continue
    log.warn("generate_video", "Failed to clean up S3 objects", {
      prefix,
      error,
    });
  }
}
