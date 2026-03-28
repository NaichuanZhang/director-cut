"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ProjectMeta } from "@/lib/types";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProjectCard({
  project,
  index,
  onDelete,
}: {
  readonly project: ProjectMeta;
  readonly index: number;
  readonly onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirmDelete) {
        onDelete(project.id);
      } else {
        setConfirmDelete(true);
        setTimeout(() => setConfirmDelete(false), 3000);
      }
    },
    [confirmDelete, onDelete, project.id],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
    >
      <Link
        href={`/project/${project.id}`}
        className="group relative block rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Film strip edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-4 flex flex-col justify-around items-center py-4 z-10"
          style={{ background: "var(--film-border)" }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-2.5 rounded-sm"
              style={{ background: "var(--film-hole)" }}
            />
          ))}
        </div>

        {/* Thumbnail area */}
        <div
          className="relative ml-4 aspect-[16/10] overflow-hidden"
          style={{ background: "var(--bg-warm)" }}
        >
          {project.thumbnailUrl ? (
            <>
              {/* Blurred backdrop */}
              <div
                className="absolute inset-0 scale-110 blur-xl opacity-40"
                style={{
                  backgroundImage: `url(${project.thumbnailUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              {/* Sharp thumbnail */}
              <img
                src={project.thumbnailUrl}
                alt={project.title}
                className="relative w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <span
                  className="block text-4xl opacity-20"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "var(--text)",
                  }}
                >
                  {project.sceneCount > 0 ? "🎬" : "📝"}
                </span>
                <span
                  className="block text-[10px] tracking-widest uppercase"
                  style={{ color: "var(--text-faint)" }}
                >
                  {project.sceneCount > 0
                    ? `${project.sceneCount} scenes`
                    : "New project"}
                </span>
              </div>
            </div>
          )}

          {/* Hover glow overlay */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background:
                "linear-gradient(to top, rgba(218,119,86,0.15) 0%, transparent 60%)",
            }}
          />

          {/* Delete button */}
          <button
            onClick={handleDelete}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 text-[10px] tracking-wider uppercase px-2 py-1 rounded-full z-20"
            style={{
              background: confirmDelete
                ? "var(--error)"
                : "rgba(0,0,0,0.6)",
              color: confirmDelete ? "var(--text)" : "var(--text-dim)",
              backdropFilter: "blur(8px)",
            }}
          >
            {confirmDelete ? "Confirm" : "Delete"}
          </button>
        </div>

        {/* Info */}
        <div className="ml-4 px-4 py-3 space-y-1">
          <h3
            className="text-base font-medium truncate"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--text)",
            }}
          >
            {project.title}
          </h3>
          <div className="flex items-center gap-3">
            <span
              className="text-[11px] tabular-nums"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--accent)",
              }}
            >
              {project.sceneCount} scene{project.sceneCount !== 1 ? "s" : ""}
            </span>
            <span
              className="text-[11px]"
              style={{ color: "var(--text-faint)" }}
            >
              {formatDate(project.updatedAt)}
            </span>
          </div>
        </div>

        {/* Bottom accent line on hover */}
        <div
          className="h-[2px] w-0 group-hover:w-full transition-all duration-500"
          style={{ background: "var(--accent)" }}
        />
      </Link>
    </motion.div>
  );
}
