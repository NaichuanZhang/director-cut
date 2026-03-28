"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectStore } from "@/stores/project-store-provider";
import { VoiceOrb } from "./voice-orb";

const TOOL_LABELS: Record<string, string> = {
  generate_script: "Writing script",
  generate_image: "Generating keyframe",
  generate_video: "Filming with Veo",
  generate_speech: "Recording narration",
};

const TOOL_ICONS: Record<string, string> = {
  generate_script: "✍",
  generate_image: "🎨",
  generate_video: "🎬",
  generate_speech: "🎙",
};

export function AgentPanel() {
  const messages = useProjectStore((s) => s.messages);
  const streamingText = useProjectStore((s) => s.streamingText);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: "var(--accent)",
            boxShadow: "0 0 8px var(--accent-glow)",
          }}
        />
        <h2
          className="text-lg tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
        >
          Director
        </h2>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 && !streamingText && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
            <span
              className="text-3xl"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text-dim)",
              }}
            >
              SayCut
            </span>
            <p
              className="text-xs leading-relaxed max-w-[200px]"
              style={{ color: "var(--text-faint)" }}
            >
              Speak or type to direct your story. I&apos;ll write the script,
              paint the scenes, and film the movie.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md text-sm"
                    style={{
                      background: "var(--accent-dim)",
                      color: "var(--text)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ) : msg.role === "tool" && msg.toolCall ? (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <span>{TOOL_ICONS[msg.toolCall.name] ?? "⚡"}</span>
                  <span className="font-medium">
                    {TOOL_LABELS[msg.toolCall.name] ?? msg.toolCall.name}
                  </span>
                  {msg.toolCall.args?.scene_id != null && (
                    <span style={{ color: "var(--text-dim)" }}>
                      — scene {String(msg.toolCall.args.scene_id)}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex justify-start">
                  <div
                    className="max-w-[90%] px-3 py-2 rounded-2xl rounded-bl-md text-sm leading-relaxed"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming text */}
        {streamingText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div
              className="max-w-[90%] px-3 py-2 rounded-2xl rounded-bl-md text-sm leading-relaxed"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-secondary)",
              }}
            >
              {streamingText}
              <span
                className="inline-block w-1.5 h-4 ml-0.5 animate-pulse"
                style={{ background: "var(--accent)" }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Voice Orb */}
      <div style={{ borderTop: "1px solid var(--border)" }}>
        <VoiceOrb />
      </div>
    </div>
  );
}
