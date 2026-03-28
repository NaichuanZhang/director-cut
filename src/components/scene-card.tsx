"use client";

import { motion } from "framer-motion";
import type { Scene } from "@/lib/types";

const STATUS_LABELS: Record<Scene["status"], string> = {
  empty: "Empty",
  scripted: "Written",
  imaging: "Composing",
  filming: "Filming",
  complete: "Ready",
  error: "Failed",
};

const STATUS_COLORS: Record<Scene["status"], string> = {
  empty: "var(--text-faint)",
  scripted: "var(--warning)",
  imaging: "var(--accent)",
  filming: "var(--accent-bright)",
  complete: "var(--success)",
  error: "var(--error)",
};

export function SceneCard({
  scene,
  onPlay,
  onEdit,
}: {
  readonly scene: Scene;
  readonly onPlay?: () => void;
  readonly onEdit?: () => void;
}) {
  const isGenerating = scene.status === "imaging" || scene.status === "filming";
  const hasMedia = scene.videoUrl || scene.imageUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={onEdit}
      className="relative rounded-lg overflow-hidden group cursor-pointer"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Film strip sprocket holes */}
      <div
        className="absolute left-0 top-0 bottom-0 w-5 flex flex-col justify-around items-center py-3 z-10"
        style={{ background: "var(--film-border)" }}
      >
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="w-2 h-3 rounded-sm"
            style={{ background: "var(--film-hole)" }}
          />
        ))}
      </div>

      <div className="ml-5">
        {/* Media preview area */}
        <div
          className="relative aspect-video overflow-hidden"
          style={{ background: "var(--bg-warm)" }}
        >
          {scene.imageUrl ? (
            <img
              src={scene.imageUrl}
              alt={scene.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isGenerating ? (
                <div className="animate-shimmer w-full h-full" />
              ) : (
                <span
                  style={{
                    color: "var(--text-faint)",
                    fontFamily: "var(--font-display)",
                    fontSize: "1.2rem",
                  }}
                >
                  {scene.index + 1}
                </span>
              )}
            </div>
          )}

          {/* Video overlay if complete */}
          {scene.videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay?.();
                }}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 0 20px var(--accent-glow)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="var(--text)"
                >
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </button>
            </div>
          )}

          {/* Progress bar for filming */}
          {scene.status === "filming" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-1"
              style={{ background: "var(--surface-3)" }}
            >
              <motion.div
                className="h-full"
                style={{ background: "var(--accent)" }}
                initial={{ width: "0%" }}
                animate={{ width: `${scene.videoPct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          {/* Status badge */}
          <div
            className="absolute top-2 right-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(0,0,0,0.6)",
              color: STATUS_COLORS[scene.status],
              backdropFilter: "blur(8px)",
            }}
          >
            {STATUS_LABELS[scene.status]}
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span
              className="text-xs font-bold tracking-wider"
              style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}
            >
              {String(scene.index + 1).padStart(2, "0")}
            </span>
            <h3
              className="text-sm font-medium truncate"
              style={{
                color: "var(--text)",
                fontFamily: "var(--font-display)",
              }}
            >
              {scene.title || "Untitled Scene"}
            </h3>
          </div>

          {scene.narrationText && (
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: "var(--text-dim)" }}
            >
              {scene.narrationText}
            </p>
          )}

          {/* Audio fallback player */}
          {scene.audioUrl && !scene.videoUrl && (
            <audio
              controls
              src={scene.audioUrl}
              className="w-full h-7 mt-1 opacity-70"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
