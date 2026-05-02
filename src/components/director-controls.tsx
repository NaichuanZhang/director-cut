"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type DirectorSettings,
  type VideoDuration,
  type VideoResolution,
  type VideoAspectRatio,
  DEFAULT_DIRECTOR_SETTINGS,
  DURATION_OPTIONS,
  RESOLUTION_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  estimateGenerationTime,
} from "@/lib/director-controls";

interface DirectorControlsProps {
  readonly settings: DirectorSettings;
  readonly onChange: (settings: DirectorSettings) => void;
  readonly disabled?: boolean;
}

export function DirectorControls({
  settings,
  onChange,
  disabled = false,
}: DirectorControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateSetting = useCallback(
    <K extends keyof DirectorSettings>(key: K, value: DirectorSettings[K]) => {
      onChange({ ...settings, [key]: value });
    },
    [settings, onChange],
  );

  const estimatedTime = estimateGenerationTime(settings);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:opacity-90 disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">🎬</span>
          <span
            className="text-xs font-medium tracking-wider uppercase"
            style={{ color: "var(--text-dim)", fontFamily: "var(--font-display)" }}
          >
            Director Controls
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] tabular-nums"
            style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}
          >
            ~{estimatedTime}s per scene
          </span>
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ color: "var(--text-faint)" }}
          >
            ▾
          </motion.span>
        </div>
      </button>

      {/* Expandable panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 space-y-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {/* Duration */}
              <ControlGroup label="Duration">
                <SegmentedControl
                  options={DURATION_OPTIONS}
                  value={settings.duration}
                  onChange={(v) => updateSetting("duration", v as VideoDuration)}
                  disabled={disabled}
                />
              </ControlGroup>

              {/* Resolution */}
              <ControlGroup label="Resolution">
                <SegmentedControl
                  options={RESOLUTION_OPTIONS}
                  value={settings.resolution}
                  onChange={(v) => updateSetting("resolution", v as VideoResolution)}
                  disabled={disabled}
                />
              </ControlGroup>

              {/* Aspect Ratio */}
              <ControlGroup label="Aspect Ratio">
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_RATIO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateSetting("aspectRatio", opt.value as VideoAspectRatio)}
                      disabled={disabled}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all disabled:opacity-40"
                      style={{
                        background:
                          settings.aspectRatio === opt.value
                            ? "var(--accent)"
                            : "var(--surface-2)",
                        color:
                          settings.aspectRatio === opt.value
                            ? "var(--text)"
                            : "var(--text-dim)",
                        border: `1px solid ${
                          settings.aspectRatio === opt.value
                            ? "var(--accent-bright)"
                            : "var(--border)"
                        }`,
                      }}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </ControlGroup>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <ToggleControl
                  label="🎥 Fixed Camera"
                  checked={settings.cameraFixed}
                  onChange={(v) => updateSetting("cameraFixed", v)}
                  disabled={disabled}
                />
                <ToggleControl
                  label="🔊 Generate Audio"
                  checked={settings.generateAudio}
                  onChange={(v) => updateSetting("generateAudio", v)}
                  disabled={disabled}
                />
                <ToggleControl
                  label="🔗 Chain Scenes"
                  checked={settings.chainScenes}
                  onChange={(v) => updateSetting("chainScenes", v)}
                  disabled={disabled}
                />
              </div>

              {/* Seed */}
              <ControlGroup label="Seed (optional)">
                <input
                  type="number"
                  placeholder="Random"
                  value={settings.seed ?? ""}
                  onChange={(e) =>
                    updateSetting(
                      "seed",
                      e.target.value ? parseInt(e.target.value, 10) : undefined,
                    )
                  }
                  disabled={disabled}
                  className="w-full px-3 py-1.5 rounded-md text-xs disabled:opacity-40"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </ControlGroup>

              {/* Reset button */}
              <button
                onClick={() => onChange(DEFAULT_DIRECTOR_SETTINGS)}
                disabled={disabled}
                className="text-[10px] tracking-wider uppercase font-medium px-3 py-1.5 rounded-full transition-colors hover:opacity-80 disabled:opacity-40"
                style={{
                  color: "var(--text-faint)",
                  border: "1px solid var(--border)",
                }}
              >
                Reset to defaults
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ControlGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 pt-3">
      <span
        className="text-[10px] tracking-wider uppercase font-medium"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
}: {
  readonly options: readonly { value: T; label: string }[];
  readonly value: T;
  readonly onChange: (v: T) => void;
  readonly disabled?: boolean;
}) {
  return (
    <div
      className="flex rounded-md overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className="flex-1 px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
          style={{
            background:
              value === opt.value ? "var(--accent)" : "var(--surface-2)",
            color:
              value === opt.value ? "var(--text)" : "var(--text-dim)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
  disabled,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-all disabled:opacity-40"
      style={{
        background: checked ? "var(--surface-2)" : "var(--surface)",
        border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
        color: checked ? "var(--text)" : "var(--text-dim)",
      }}
    >
      <div
        className="w-3 h-3 rounded-full transition-colors"
        style={{
          background: checked ? "var(--accent)" : "var(--surface-3)",
          boxShadow: checked ? "0 0 6px var(--accent-glow)" : "none",
        }}
      />
      <span>{label}</span>
    </button>
  );
}
