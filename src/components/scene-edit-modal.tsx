"use client";

import { useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Scene } from "@/lib/types";

type RegenTarget = "image" | "video" | "speech";

const REGEN_BUTTONS: readonly {
  readonly target: RegenTarget;
  readonly label: string;
  readonly icon: string;
}[] = [
  { target: "image", label: "Regenerate Image", icon: "🎨" },
  { target: "video", label: "Regenerate Video", icon: "🎬" },
  { target: "speech", label: "Regenerate Audio", icon: "🎙" },
];

export function SceneEditModal({
  scene,
  isStreaming,
  onClose,
  onRegenerate,
}: {
  readonly scene: Scene;
  readonly isStreaming: boolean;
  readonly onClose: () => void;
  readonly onRegenerate: (sceneId: string, what: RegenTarget) => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      <motion.div
        ref={backdropRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(8px)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
            style={{
              background: "rgba(0, 0, 0, 0.6)",
              color: "var(--text-dim)",
              backdropFilter: "blur(8px)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>

          {/* Media preview */}
          <div className="relative aspect-video overflow-hidden rounded-t-xl" style={{ background: "var(--bg-warm)" }}>
            {scene.videoUrl ? (
              <video
                src={scene.videoUrl}
                className="w-full h-full object-contain"
                controls
                playsInline
                muted
              />
            ) : scene.imageUrl ? (
              <img
                src={scene.imageUrl}
                alt={scene.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span
                  className="text-4xl"
                  style={{ color: "var(--text-faint)", fontFamily: "var(--font-display)" }}
                >
                  {scene.index + 1}
                </span>
              </div>
            )}
          </div>

          {/* Scene details */}
          <div className="p-5 space-y-4">
            {/* Title */}
            <div className="flex items-baseline gap-2">
              <span
                className="text-xs font-bold tracking-wider"
                style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}
              >
                {String(scene.index + 1).padStart(2, "0")}
              </span>
              <h2
                className="text-lg font-medium"
                style={{ color: "var(--text)", fontFamily: "var(--font-display)" }}
              >
                {scene.title || "Untitled Scene"}
              </h2>
            </div>

            {/* Narration */}
            {scene.narrationText && (
              <DetailBlock label="Narration" text={scene.narrationText} />
            )}

            {/* Visual description */}
            {scene.visualDescription && (
              <DetailBlock label="Visual Description" text={scene.visualDescription} />
            )}

            {/* Dialogue directions */}
            {scene.dialogueDirections && (
              <DetailBlock label="Dialogue & Audio" text={scene.dialogueDirections} />
            )}

            {/* Audio player */}
            {scene.audioUrl && (
              <div className="space-y-1">
                <span
                  className="text-[10px] tracking-wider uppercase font-medium"
                  style={{ color: "var(--text-faint)" }}
                >
                  Narration Audio
                </span>
                <audio controls src={scene.audioUrl} className="w-full h-8 opacity-80" />
              </div>
            )}

            {/* Regeneration buttons */}
            <div
              className="flex flex-wrap gap-2 pt-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {REGEN_BUTTONS.map(({ target, label, icon }) => (
                <button
                  key={target}
                  onClick={() => onRegenerate(scene.id, target)}
                  disabled={isStreaming}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DetailBlock({
  label,
  text,
}: {
  readonly label: string;
  readonly text: string;
}) {
  return (
    <div className="space-y-1">
      <span
        className="text-[10px] tracking-wider uppercase font-medium"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </span>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--text-dim)" }}
      >
        {text}
      </p>
    </div>
  );
}
