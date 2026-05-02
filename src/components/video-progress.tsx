"use client";

import { motion } from "framer-motion";
import type { VideoGenerationStage } from "@/lib/types";

interface VideoProgressProps {
  readonly stage: VideoGenerationStage;
  readonly percent: number;
  readonly imageUrl?: string | null;
  readonly sceneTitle?: string;
  readonly estimatedSeconds?: number;
}

const STAGE_LABELS: Record<VideoGenerationStage, string> = {
  idle: "",
  queued: "In queue…",
  processing: "Processing…",
  rendering: "Rendering…",
  complete: "Complete!",
};

const STAGE_ICONS: Record<VideoGenerationStage, string> = {
  idle: "",
  queued: "⏳",
  processing: "🎞️",
  rendering: "🎬",
  complete: "✅",
};

export function VideoProgress({
  stage,
  percent,
  imageUrl,
  sceneTitle,
  estimatedSeconds,
}: VideoProgressProps) {
  if (stage === "idle") return null;

  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-lg">
      {/* Ken Burns effect on keyframe image */}
      {imageUrl && (
        <motion.img
          src={imageUrl}
          alt={sceneTitle ?? "Generating…"}
          className="absolute inset-0 w-full h-full object-cover"
          animate={{
            scale: [1, 1.08, 1.04, 1.1],
            x: [0, -8, 4, -4],
            y: [0, -4, 2, -6],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      )}

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: imageUrl
            ? "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 100%)"
            : "var(--surface-2)",
        }}
      />

      {/* Progress content */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 px-4">
        {/* Stage indicator */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{STAGE_ICONS[stage]}</span>
          <span
            className="text-sm font-medium"
            style={{
              color: "var(--text)",
              fontFamily: "var(--font-display)",
            }}
          >
            {STAGE_LABELS[stage]}
          </span>
        </div>

        {/* Multi-stage progress bar */}
        <div className="w-full max-w-xs">
          <div
            className="relative h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  stage === "complete"
                    ? "var(--success)"
                    : "linear-gradient(90deg, var(--accent), var(--accent-bright))",
                boxShadow: "0 0 8px var(--accent-glow)",
              }}
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(percent, 100)}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />

            {/* Stage markers */}
            <div className="absolute inset-0 flex">
              {[25, 60, 90].map((marker) => (
                <div
                  key={marker}
                  className="absolute top-0 bottom-0 w-px"
                  style={{
                    left: `${marker}%`,
                    background: "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Stage labels below progress bar */}
          <div className="flex justify-between mt-1.5">
            {(["queued", "processing", "rendering", "complete"] as const).map(
              (s) => (
                <span
                  key={s}
                  className="text-[9px] uppercase tracking-wider font-medium"
                  style={{
                    color:
                      stage === s || stageIndex(stage) > stageIndex(s)
                        ? "var(--accent)"
                        : "var(--text-faint)",
                    opacity:
                      stage === s || stageIndex(stage) > stageIndex(s)
                        ? 1
                        : 0.5,
                  }}
                >
                  {s === "complete" ? "done" : s}
                </span>
              ),
            )}
          </div>
        </div>

        {/* ETA */}
        {estimatedSeconds && stage !== "complete" && (
          <span
            className="text-[10px] mt-2 tabular-nums"
            style={{
              color: "var(--text-faint)",
              fontFamily: "var(--font-mono)",
            }}
          >
            ~{Math.max(1, Math.round(estimatedSeconds * (1 - percent / 100)))}s
            remaining
          </span>
        )}
      </div>
    </div>
  );
}

function stageIndex(stage: VideoGenerationStage): number {
  const order: VideoGenerationStage[] = [
    "idle",
    "queued",
    "processing",
    "rendering",
    "complete",
  ];
  return order.indexOf(stage);
}
