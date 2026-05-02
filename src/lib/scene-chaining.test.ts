import { describe, it, expect, beforeEach } from "vitest";
import {
  storeLastFrame,
  getLastFrame,
  clearChainStore,
  getFirstFrameForScene,
  buildChainPlan,
  _internals,
} from "./scene-chaining";

describe("scene-chaining", () => {
  beforeEach(() => {
    clearChainStore();
  });

  describe("storeLastFrame / getLastFrame", () => {
    it("stores and retrieves a last frame", () => {
      storeLastFrame("scene-1", "base64data");
      expect(getLastFrame("scene-1")).toBe("base64data");
    });

    it("returns undefined for unknown scene", () => {
      expect(getLastFrame("nonexistent")).toBeUndefined();
    });

    it("overwrites previous value", () => {
      storeLastFrame("scene-1", "old");
      storeLastFrame("scene-1", "new");
      expect(getLastFrame("scene-1")).toBe("new");
    });
  });

  describe("clearChainStore", () => {
    it("removes all stored frames", () => {
      storeLastFrame("scene-1", "data1");
      storeLastFrame("scene-2", "data2");
      clearChainStore();
      expect(getLastFrame("scene-1")).toBeUndefined();
      expect(getLastFrame("scene-2")).toBeUndefined();
    });
  });

  describe("getFirstFrameForScene", () => {
    const allSceneIds = ["scene-0", "scene-1", "scene-2"];

    it("returns keyframe for first scene (index 0)", () => {
      const result = getFirstFrameForScene("scene-0", 0, allSceneIds, "keyframe-data");
      expect(result).toBe("keyframe-data");
    });

    it("returns undefined for first scene with no keyframe", () => {
      const result = getFirstFrameForScene("scene-0", 0, allSceneIds);
      expect(result).toBeUndefined();
    });

    it("returns last frame of previous scene when available", () => {
      storeLastFrame("scene-0", "last-frame-0");
      const result = getFirstFrameForScene("scene-1", 1, allSceneIds, "keyframe-1");
      expect(result).toBe("last-frame-0");
    });

    it("falls back to keyframe when previous scene has no last frame", () => {
      const result = getFirstFrameForScene("scene-1", 1, allSceneIds, "keyframe-1");
      expect(result).toBe("keyframe-1");
    });

    it("chains through multiple scenes", () => {
      storeLastFrame("scene-0", "frame-0");
      storeLastFrame("scene-1", "frame-1");

      const result = getFirstFrameForScene("scene-2", 2, allSceneIds);
      expect(result).toBe("frame-1");
    });
  });

  describe("buildChainPlan", () => {
    it("builds plan for empty scene list", () => {
      const plan = buildChainPlan([], new Map());
      expect(plan.scenes).toHaveLength(0);
    });

    it("builds plan with keyframes only", () => {
      const keyframes = new Map([
        ["scene-0", "kf-0"],
        ["scene-1", "kf-1"],
      ]);

      const plan = buildChainPlan(["scene-0", "scene-1"], keyframes);
      expect(plan.scenes).toHaveLength(2);
      expect(plan.scenes[0].firstFrameBase64).toBe("kf-0");
      expect(plan.scenes[1].firstFrameBase64).toBe("kf-1"); // No chain available yet
    });

    it("builds plan with chained scenes", () => {
      storeLastFrame("scene-0", "last-0");

      const keyframes = new Map([
        ["scene-0", "kf-0"],
        ["scene-1", "kf-1"],
      ]);

      const plan = buildChainPlan(["scene-0", "scene-1"], keyframes);
      expect(plan.scenes[0].firstFrameBase64).toBe("kf-0"); // First scene uses keyframe
      expect(plan.scenes[1].firstFrameBase64).toBe("last-0"); // Second uses chain
    });

    it("includes stored last frames in the plan", () => {
      storeLastFrame("scene-0", "last-0");

      const plan = buildChainPlan(["scene-0", "scene-1"], new Map());
      expect(plan.scenes[0].lastFrameBase64).toBe("last-0");
      expect(plan.scenes[1].lastFrameBase64).toBeUndefined();
    });
  });
});
