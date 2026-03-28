"use client";

import Link from "next/link";
import { useProjectStore } from "@/stores/project-store-provider";
import { AgentPanel } from "./agent-panel";
import { SceneCard } from "./scene-card";
import { ScenePlayer } from "./scene-player";

export function AppShell() {
  const scenes = useProjectStore((s) => s.scenes);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const setCurrentIndex = useProjectStore((s) => s.setCurrentSceneIndex);

  const handlePlayScene = (index: number) => {
    setCurrentIndex(index);
    setPlaying(true);
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Agent Panel — Left sidebar */}
      <div className="w-[340px] min-w-[340px] flex-shrink-0 h-full">
        <AgentPanel />
      </div>

      {/* Main area — Scenes or Player */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center w-7 h-7 rounded-full transition-colors hover:opacity-80"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-dim)",
              }}
              aria-label="Back to projects"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1
              className="text-xl tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text)",
              }}
            >
              SayCut
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {scenes.some((s) => s.status === "complete") && !isPlaying && (
              <button
                onClick={() => handlePlayScene(0)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                style={{
                  background: "var(--accent)",
                  color: "var(--text)",
                  boxShadow: "0 0 20px var(--accent-glow)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Play Story
              </button>
            )}

            {/* Sponsor badges */}
            <div className="flex items-center gap-2">
              {["Gemini", "Imagen", "Veo 3.1"].map((name) => (
                <span
                  key={name}
                  className="text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-faint)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isPlaying ? (
            <ScenePlayer />
          ) : (
            <div className="h-full overflow-y-auto px-6 py-6">
              {scenes.length === 0 ? (
                /* Empty state */
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="text-center max-w-md space-y-4">
                    <h2
                      className="text-4xl"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Direct your story
                    </h2>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--text-dim)" }}
                    >
                      Speak or type your movie idea. SayCut will write the
                      script, generate the visuals, and film each scene with
                      full audio — dialogue, sound effects, and ambient sounds.
                    </p>
                    <div className="flex items-center justify-center gap-6 pt-4">
                      {[
                        { icon: "✍", label: "Script" },
                        { icon: "→", label: "" },
                        { icon: "🎨", label: "Keyframe" },
                        { icon: "→", label: "" },
                        { icon: "🎬", label: "Video" },
                      ].map((step, i) => (
                        <div
                          key={i}
                          className="flex flex-col items-center gap-1"
                        >
                          <span className="text-lg">{step.icon}</span>
                          {step.label && (
                            <span
                              className="text-[10px] tracking-wider uppercase"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {step.label}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Scene grid */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {scenes.map((scene, i) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      onPlay={() => handlePlayScene(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer
          className="flex items-center justify-center gap-2 px-6 py-2 flex-shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span
            className="text-[10px] tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Built with
          </span>
          {["Google DeepMind", "Gemini 3 Flash", "Imagen 3", "Veo 3.1"].map(
            (s) => (
              <span
                key={s}
                className="text-[10px] tracking-wider"
                style={{ color: "var(--text-dim)" }}
              >
                {s}
              </span>
            ),
          )}
        </footer>
      </div>
    </div>
  );
}
