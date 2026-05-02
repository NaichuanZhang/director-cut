import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeTool,
  clearImageCache,
  setDirectorSettings,
  getDirectorSettings,
  setSceneOrder,
} from "./index";
import { DEFAULT_DIRECTOR_SETTINGS } from "@/lib/director-controls";

// Mock all tool modules
vi.mock("./generate-script", () => ({
  generateScript: vi.fn().mockResolvedValue({
    scenes: [
      { title: "Scene 1", narrationText: "...", visualDescription: "...", dialogueDirections: "..." },
      { title: "Scene 2", narrationText: "...", visualDescription: "...", dialogueDirections: "..." },
    ],
  }),
}));

vi.mock("./generate-image", () => ({
  generateImage: vi.fn().mockResolvedValue({
    sceneId: "scene-0",
    imageUrl: "data:image/png;base64,fakeimage",
  }),
}));

vi.mock("./generate-video", () => ({
  generateVideo: vi.fn().mockResolvedValue({
    sceneId: "scene-0",
    videoUrl: "data:video/mp4;base64,fakevideo",
  }),
}));

vi.mock("./generate-speech", () => ({
  generateSpeech: vi.fn().mockResolvedValue({
    sceneId: "scene-0",
    audioUrl: "data:audio/mpeg;base64,fakeaudio",
  }),
}));

vi.mock("@/lib/scene-chaining", () => ({
  clearChainStore: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { generateVideo } from "./generate-video";
import { generateImage } from "./generate-image";
import { generateScript } from "./generate-script";
import { generateSpeech } from "./generate-speech";

const mockGenerateVideo = vi.mocked(generateVideo);
const mockGenerateImage = vi.mocked(generateImage);
const mockGenerateScript = vi.mocked(generateScript);
const mockGenerateSpeech = vi.mocked(generateSpeech);

describe("tools/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearImageCache();
    // Reset director settings to default
    setDirectorSettings(DEFAULT_DIRECTOR_SETTINGS);
  });

  describe("executeTool", () => {
    it("routes generate_script correctly", async () => {
      await executeTool("generate_script", {
        description: "A hero's journey",
        num_scenes: 3,
      });
      expect(mockGenerateScript).toHaveBeenCalledWith("A hero's journey", 3);
    });

    it("routes generate_image correctly and caches result", async () => {
      await executeTool("generate_image", {
        scene_id: "scene-0",
        visual_description: "A dark forest",
      });
      expect(mockGenerateImage).toHaveBeenCalledWith("scene-0", "A dark forest");
    });

    it("routes generate_video with scene chaining context", async () => {
      // Set up scene order
      setSceneOrder(["scene-0", "scene-1"]);

      await executeTool("generate_video", {
        scene_id: "scene-1",
        visual_description: "A sunrise",
        dialogue_directions: "Birds singing",
      });

      // Check the call was made with the right positional args
      expect(mockGenerateVideo).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateVideo.mock.calls[0];
      expect(callArgs[0]).toBe("scene-1"); // sceneId
      expect(callArgs[1]).toBe("A sunrise"); // visual
      expect(callArgs[2]).toBe("Birds singing"); // dialogue
      // callArgs[3] is the onProgress wrapper (may be undefined)
      // callArgs[4] is keyframe (undefined — not cached)
      expect(callArgs[5]).toBe(1); // sceneIndex
      expect(callArgs[6]).toEqual(["scene-0", "scene-1"]); // allSceneIds
      expect(callArgs[7]).toEqual(DEFAULT_DIRECTOR_SETTINGS); // settings
    });

    it("routes generate_speech correctly", async () => {
      await executeTool("generate_speech", {
        scene_id: "scene-0",
        text: "Hello world",
      });
      expect(mockGenerateSpeech).toHaveBeenCalledWith("scene-0", "Hello world");
    });

    it("throws on unknown tool", async () => {
      await expect(
        executeTool("unknown_tool", {}),
      ).rejects.toThrow("Unknown tool: unknown_tool");
    });

    it("passes cached keyframe to generate_video", async () => {
      // First generate an image to cache it
      mockGenerateImage.mockResolvedValueOnce({
        sceneId: "scene-0",
        imageUrl: "data:image/png;base64,cached-keyframe-data",
      });
      await executeTool("generate_image", {
        scene_id: "scene-0",
        visual_description: "test",
      });

      // Now generate video — should receive the cached keyframe
      setSceneOrder(["scene-0"]);
      await executeTool("generate_video", {
        scene_id: "scene-0",
        visual_description: "test",
        dialogue_directions: "test",
      });

      const callArgs = mockGenerateVideo.mock.calls[0];
      expect(callArgs[4]).toBe("cached-keyframe-data"); // keyframe base64
    });
  });

  describe("setDirectorSettings / getDirectorSettings", () => {
    it("returns defaults initially", () => {
      const settings = getDirectorSettings();
      expect(settings).toEqual(DEFAULT_DIRECTOR_SETTINGS);
    });

    it("updates settings", () => {
      const custom = {
        ...DEFAULT_DIRECTOR_SETTINGS,
        duration: 10 as const,
        resolution: "1080p" as const,
      };
      setDirectorSettings(custom);
      expect(getDirectorSettings()).toEqual(custom);
    });

    it("passes updated settings to generate_video", async () => {
      const custom = {
        ...DEFAULT_DIRECTOR_SETTINGS,
        duration: 10 as const,
        resolution: "1080p" as const,
      };
      setDirectorSettings(custom);
      setSceneOrder(["scene-0"]);

      await executeTool("generate_video", {
        scene_id: "scene-0",
        visual_description: "test",
        dialogue_directions: "test",
      });

      const callArgs = mockGenerateVideo.mock.calls[0];
      expect(callArgs[7]).toEqual(custom);
    });
  });

  describe("clearImageCache", () => {
    it("runs without error", () => {
      expect(() => clearImageCache()).not.toThrow();
    });
  });

  describe("setSceneOrder", () => {
    it("updates scene order for chaining", async () => {
      setSceneOrder(["a", "b", "c"]);

      await executeTool("generate_video", {
        scene_id: "b",
        visual_description: "test",
        dialogue_directions: "test",
      });

      const callArgs = mockGenerateVideo.mock.calls[0];
      expect(callArgs[0]).toBe("b");
      expect(callArgs[5]).toBe(1); // index of "b"
      expect(callArgs[6]).toEqual(["a", "b", "c"]);
    });

    it("passes -1 index as undefined for unknown scene", async () => {
      setSceneOrder(["a", "b"]);

      await executeTool("generate_video", {
        scene_id: "unknown",
        visual_description: "test",
        dialogue_directions: "test",
      });

      const callArgs = mockGenerateVideo.mock.calls[0];
      expect(callArgs[5]).toBeUndefined(); // -1 becomes undefined
    });
  });
});
