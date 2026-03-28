"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useProjectsStore } from "@/stores/projects-store";
import { ProjectCard } from "./project-card";
import { idbStorage } from "@/lib/idb-storage";

export function LandingPage() {
  const projects = useProjectsStore((s) => s.projects);
  const hydrated = useProjectsStore((s) => s.hydrated);
  const addProject = useProjectsStore((s) => s.addProject);
  const removeProject = useProjectsStore((s) => s.removeProject);
  const router = useRouter();

  const handleNewProject = useCallback(() => {
    const id = crypto.randomUUID();
    addProject({
      id,
      title: "Untitled Project",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sceneCount: 0,
      thumbnailUrl: null,
    });
    router.push(`/project/${id}`);
  }, [addProject, router]);

  const handleDelete = useCallback(
    async (id: string) => {
      removeProject(id);
      // Clean up per-project IDB data
      try {
        await idbStorage.removeItem(`saycut-project-${id}`);
      } catch {
        // best-effort cleanup
      }
    },
    [removeProject],
  );

  // Sort projects by most recently updated
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  if (!hydrated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-3"
        >
          <div
            className="w-8 h-8 mx-auto border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <p
            className="text-xs tracking-widest uppercase"
            style={{ color: "var(--text-faint)" }}
          >
            Loading
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* Hero header */}
      <header className="relative px-8 pt-16 pb-12 md:px-16 md:pt-24 md:pb-16">
        {/* Accent glow behind title */}
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-20 blur-3xl pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, var(--accent) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h1
              className="text-6xl md:text-8xl tracking-tight leading-none"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text)",
              }}
            >
              SayCut
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="mt-4 flex items-center gap-4"
          >
            <div
              className="h-[1px] w-12"
              style={{ background: "var(--accent)" }}
            />
            <p
              className="text-sm md:text-base tracking-wide"
              style={{
                fontFamily: "var(--font-sans)",
                color: "var(--text-dim)",
              }}
            >
              Voice-first AI movie director
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="mt-8"
          >
            <button
              onClick={handleNewProject}
              className="group flex items-center gap-3 px-6 py-3 rounded-full text-sm font-medium tracking-wide transition-all duration-300 hover:scale-105"
              style={{
                background: "var(--accent)",
                color: "var(--text)",
                boxShadow: "0 0 30px var(--accent-glow), 0 0 60px rgba(218,119,86,0.1)",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Project
            </button>
          </motion.div>
        </div>
      </header>

      {/* Projects section */}
      <main className="flex-1 px-8 pb-16 md:px-16">
        <div className="max-w-5xl mx-auto">
          {sorted.length === 0 ? (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
                style={{
                  background: "var(--surface)",
                  border: "1px dashed var(--border-warm)",
                }}
              >
                <span
                  className="text-3xl"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--text-faint)",
                  }}
                >
                  🎬
                </span>
              </div>
              <h2
                className="text-2xl md:text-3xl mb-3"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--text-secondary)",
                }}
              >
                Your stories begin here
              </h2>
              <p
                className="text-sm max-w-sm leading-relaxed"
                style={{ color: "var(--text-dim)" }}
              >
                Create a new project, speak your story idea, and watch SayCut
                write, paint, and film each scene.
              </p>
            </motion.div>
          ) : (
            <>
              {/* Section label */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="flex items-center gap-3 mb-6"
              >
                <span
                  className="text-[11px] tracking-[0.2em] uppercase font-medium"
                  style={{ color: "var(--text-faint)" }}
                >
                  Projects
                </span>
                <div
                  className="flex-1 h-[1px]"
                  style={{ background: "var(--border)" }}
                />
                <span
                  className="text-[11px] tabular-nums"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-faint)",
                  }}
                >
                  {sorted.length}
                </span>
              </motion.div>

              {/* Project grid — first item is hero-sized */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {sorted.map((project, i) => (
                  <div
                    key={project.id}
                    className={i === 0 && sorted.length > 2 ? "md:col-span-2" : ""}
                  >
                    <ProjectCard
                      project={project}
                      index={i}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}

                {/* New project card */}
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: sorted.length * 0.08 + 0.1,
                    ease: "easeOut",
                  }}
                >
                  <button
                    onClick={handleNewProject}
                    className="group w-full aspect-[16/10] rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                    style={{
                      background: "transparent",
                      border: "1px dashed var(--border-warm)",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        style={{ color: "var(--accent)" }}
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </div>
                    <span
                      className="text-xs tracking-widest uppercase"
                      style={{ color: "var(--text-faint)" }}
                    >
                      New project
                    </span>
                  </button>
                </motion.div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="flex items-center justify-center gap-2 px-8 py-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span
          className="text-[10px] tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Built with
        </span>
        {["Google DeepMind", "Gemini 3 Flash", "Imagen 4", "Veo 3.1"].map(
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
  );
}
