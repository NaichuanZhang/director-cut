"use client";

import { useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/stores/project-store";

export function ScenePlayer() {
  const scenes = useProjectStore((s) => s.scenes);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const currentIndex = useProjectStore((s) => s.currentSceneIndex);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentIndex = useProjectStore((s) => s.setCurrentSceneIndex);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const completedScenes = scenes.filter((s) => s.status === "complete");
  const current = completedScenes[currentIndex];

  const advanceScene = useCallback(() => {
    if (currentIndex < completedScenes.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setPlaying(false);
      setCurrentIndex(0);
    }
  }, [currentIndex, completedScenes.length, setCurrentIndex, setPlaying]);

  useEffect(() => {
    if (!isPlaying || !current) return;

    if (current.videoUrl && videoRef.current) {
      videoRef.current.play().catch(() => {});
    } else if (current.audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [isPlaying, current, currentIndex]);

  const handlePlay = useCallback(() => {
    if (completedScenes.length === 0) return;
    setCurrentIndex(0);
    setPlaying(true);
  }, [completedScenes.length, setCurrentIndex, setPlaying]);

  if (!isPlaying || !current) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        {completedScenes.length > 0 ? (
          <>
            <button
              onClick={handlePlay}
              className="w-20 h-20 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              style={{
                background: "radial-gradient(circle at 40% 40%, var(--accent-bright), var(--accent-dim))",
                boxShadow: "0 0 40px var(--accent-glow), 0 0 80px rgba(218, 119, 86, 0.1)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text)">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            </button>
            <span className="text-sm" style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)" }}>
              Play {completedScenes.length} scene{completedScenes.length !== 1 ? "s" : ""}
            </span>
          </>
        ) : (
          <div className="text-center px-8">
            <p
              className="text-2xl mb-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-dim)" }}
            >
              Your scenes will appear here
            </p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Speak or type a story to get started
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Cinematic bars */}
      <div className="absolute top-0 left-0 right-0 h-8 z-10" style={{ background: "linear-gradient(to bottom, black, transparent)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-24 z-10" style={{ background: "linear-gradient(to top, black, transparent)" }} />

      {/* Media area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
          >
            {current.videoUrl ? (
              <video
                ref={videoRef}
                src={current.videoUrl}
                onEnded={advanceScene}
                className="w-full h-full object-contain"
                playsInline
              />
            ) : current.imageUrl ? (
              <>
                <img
                  src={current.imageUrl}
                  alt={current.title}
                  className="w-full h-full object-contain"
                />
                {current.audioUrl && (
                  <audio ref={audioRef} src={current.audioUrl} onEnded={advanceScene} />
                )}
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Subtitle overlay */}
      <div className="absolute bottom-12 left-0 right-0 z-20 flex justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.p
            key={current.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-center text-sm max-w-lg px-4 py-2 rounded-lg"
            style={{
              background: "rgba(0, 0, 0, 0.7)",
              color: "var(--text)",
              backdropFilter: "blur(8px)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {current.narrationText}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Controls bar */}
      <div
        className="relative z-20 flex items-center justify-between px-6 py-3"
        style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(12px)" }}
      >
        <button
          onClick={() => setPlaying(false)}
          className="text-xs tracking-wider uppercase font-medium px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
          style={{ color: "var(--text-dim)", border: "1px solid var(--border)" }}
        >
          Close
        </button>

        <div className="flex items-center gap-3">
          {/* Scene dots */}
          {completedScenes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentIndex(i)}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i === currentIndex ? "var(--accent)" : "var(--text-faint)",
                boxShadow: i === currentIndex ? "0 0 8px var(--accent-glow)" : "none",
                transform: i === currentIndex ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>

        <span className="text-xs tabular-nums" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {currentIndex + 1} / {completedScenes.length}
        </span>
      </div>
    </div>
  );
}
