"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { useAgent } from "@/hooks/use-agent";
import { useProjectStore } from "@/stores/project-store-provider";

export function VoiceOrb() {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const { sendMessage } = useAgent();
  const isStreaming = useProjectStore((s) => s.isStreaming);
  const [textInput, setTextInput] = useState("");

  const handleToggleRecord = useCallback(async () => {
    if (isRecording) {
      const audio = await stopRecording();
      if (audio) sendMessage({ type: "audio", data: audio });
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording, sendMessage]);

  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = textInput.trim();
      if (!text || isStreaming) return;
      setTextInput("");
      sendMessage({ type: "text", data: text });
    },
    [textInput, isStreaming, sendMessage],
  );

  return (
    <div className="flex flex-col items-center gap-4 py-4 px-4">
      {/* The Orb */}
      <button
        onClick={handleToggleRecord}
        disabled={isStreaming}
        className="relative group focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {/* Outer glow ring */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.3, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, var(--accent-glow-strong) 0%, transparent 70%)",
                animation: "recording-pulse 1.5s ease-in-out infinite",
              }}
            />
          )}
        </AnimatePresence>

        {/* Main orb */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300"
          style={{
            background: isRecording
              ? "radial-gradient(circle at 40% 40%, var(--accent-bright), var(--accent-dim))"
              : isStreaming
                ? "radial-gradient(circle at 40% 40%, var(--surface-3), var(--surface-2))"
                : "radial-gradient(circle at 40% 40%, var(--accent), var(--accent-dim))",
            boxShadow: isRecording
              ? "0 0 30px var(--accent-glow-strong), 0 0 60px var(--accent-glow), inset 0 -4px 8px rgba(0,0,0,0.3)"
              : "0 0 20px var(--accent-glow), inset 0 -4px 8px rgba(0,0,0,0.3)",
            animation:
              !isRecording && !isStreaming
                ? "warm-pulse 3s ease-in-out infinite"
                : undefined,
          }}
        >
          {/* Icon */}
          {isStreaming ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-t-transparent rounded-full"
              style={{
                borderColor: "var(--text-dim)",
                borderTopColor: "transparent",
              }}
            />
          ) : isRecording ? (
            <div
              className="w-4 h-4 rounded-sm"
              style={{ background: "var(--text)" }}
            />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          )}
        </motion.div>
      </button>

      {/* State label */}
      <span
        className="text-xs tracking-widest uppercase"
        style={{
          color: isRecording ? "var(--accent)" : "var(--text-dim)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {isStreaming
          ? "Creating..."
          : isRecording
            ? "Listening"
            : "Tap to speak"}
      </span>

      {/* Text input fallback */}
      <form onSubmit={handleTextSubmit} className="w-full max-w-xs">
        <div
          className="flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type your direction..."
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
            style={{ color: "var(--text)", fontFamily: "var(--font-sans)" }}
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isStreaming}
            className="text-xs font-medium px-2 py-1 rounded-full transition-opacity disabled:opacity-30"
            style={{ color: "var(--accent)" }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
