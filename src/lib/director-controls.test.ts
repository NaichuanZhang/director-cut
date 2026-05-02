import { describe, it, expect } from "vitest";
import {
  validateSettings,
  estimateGenerationTime,
  DEFAULT_DIRECTOR_SETTINGS,
  DURATION_OPTIONS,
  RESOLUTION_OPTIONS,
  ASPECT_RATIO_OPTIONS,
} from "./director-controls";

describe("director-controls", () => {
  describe("DEFAULT_DIRECTOR_SETTINGS", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_DIRECTOR_SETTINGS.duration).toBe(5);
      expect(DEFAULT_DIRECTOR_SETTINGS.resolution).toBe("720p");
      expect(DEFAULT_DIRECTOR_SETTINGS.aspectRatio).toBe("16:9");
      expect(DEFAULT_DIRECTOR_SETTINGS.cameraFixed).toBe(false);
      expect(DEFAULT_DIRECTOR_SETTINGS.generateAudio).toBe(true);
      expect(DEFAULT_DIRECTOR_SETTINGS.chainScenes).toBe(true);
      expect(DEFAULT_DIRECTOR_SETTINGS.seed).toBeUndefined();
    });
  });

  describe("validateSettings", () => {
    it("returns defaults for empty input", () => {
      const result = validateSettings({});
      expect(result).toEqual(DEFAULT_DIRECTOR_SETTINGS);
    });

    it("preserves provided values", () => {
      const result = validateSettings({
        duration: 10,
        resolution: "1080p",
        cameraFixed: true,
      });
      expect(result.duration).toBe(10);
      expect(result.resolution).toBe("1080p");
      expect(result.cameraFixed).toBe(true);
      // Defaults for unset
      expect(result.aspectRatio).toBe("16:9");
      expect(result.generateAudio).toBe(true);
    });

    it("preserves seed when provided", () => {
      const result = validateSettings({ seed: 42 });
      expect(result.seed).toBe(42);
    });

    it("allows undefined seed", () => {
      const result = validateSettings({ seed: undefined });
      expect(result.seed).toBeUndefined();
    });
  });

  describe("estimateGenerationTime", () => {
    it("returns base time for defaults", () => {
      const time = estimateGenerationTime(DEFAULT_DIRECTOR_SETTINGS);
      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThan(200);
    });

    it("increases for 10s duration", () => {
      const base = estimateGenerationTime(DEFAULT_DIRECTOR_SETTINGS);
      const longer = estimateGenerationTime({
        ...DEFAULT_DIRECTOR_SETTINGS,
        duration: 10,
      });
      expect(longer).toBeGreaterThan(base);
    });

    it("increases for 1080p resolution", () => {
      const base = estimateGenerationTime(DEFAULT_DIRECTOR_SETTINGS);
      const hd = estimateGenerationTime({
        ...DEFAULT_DIRECTOR_SETTINGS,
        resolution: "1080p",
      });
      expect(hd).toBeGreaterThan(base);
    });

    it("decreases for 480p resolution", () => {
      const base = estimateGenerationTime(DEFAULT_DIRECTOR_SETTINGS);
      const low = estimateGenerationTime({
        ...DEFAULT_DIRECTOR_SETTINGS,
        resolution: "480p",
      });
      expect(low).toBeLessThan(base);
    });

    it("increases with audio enabled", () => {
      const noAudio = estimateGenerationTime({
        ...DEFAULT_DIRECTOR_SETTINGS,
        generateAudio: false,
      });
      const withAudio = estimateGenerationTime({
        ...DEFAULT_DIRECTOR_SETTINGS,
        generateAudio: true,
      });
      expect(withAudio).toBeGreaterThan(noAudio);
    });

    it("never returns less than 30 seconds", () => {
      const time = estimateGenerationTime({
        ...DEFAULT_DIRECTOR_SETTINGS,
        duration: 5,
        resolution: "480p",
        generateAudio: false,
      });
      expect(time).toBeGreaterThanOrEqual(30);
    });
  });

  describe("option constants", () => {
    it("DURATION_OPTIONS has 2 options", () => {
      expect(DURATION_OPTIONS).toHaveLength(2);
      expect(DURATION_OPTIONS.map((o) => o.value)).toEqual([5, 10]);
    });

    it("RESOLUTION_OPTIONS has 3 options", () => {
      expect(RESOLUTION_OPTIONS).toHaveLength(3);
      expect(RESOLUTION_OPTIONS.map((o) => o.value)).toEqual([
        "480p",
        "720p",
        "1080p",
      ]);
    });

    it("ASPECT_RATIO_OPTIONS has 5 options", () => {
      expect(ASPECT_RATIO_OPTIONS).toHaveLength(5);
      expect(ASPECT_RATIO_OPTIONS.map((o) => o.value)).toEqual([
        "16:9",
        "9:16",
        "1:1",
        "4:3",
        "3:4",
      ]);
    });
  });
});
