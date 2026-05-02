import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateVideo } from "./generate-video";

// Mock the seedance client
vi.mock("@/lib/seedance-client", () => ({
  generateVideo: vi.fn(),
}));

// Mock scene chaining
vi.mock("@/lib/scene-chaining", () => ({
  storeLastFrame: vi.fn(),
  getFirstFrameForScene: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { generateVideo as seedanceGenerate } from "@/lib/seedance-client";
import { storeLastFrame, getFirstFrameForScene } from "@/lib/scene-chaining";

const mockSeedanceGenerate = vi.mocked(seedanceGenerate);
const mockStoreLastFrame = vi.mocked(storeLastFrame);
const mockGetFirstFrame = vi.mocked(getFirstFrameForScene);

describe("generateVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for downloading video
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode("fake-video-data").buffer),
    }) as unknown as typeof fetch;
  });

  it("calls seedance with combined prompt", async () => {
    mockSeedanceGenerate.mockResolvedValue({
      taskId: "task-123",
      videoUrl: "https://cdn.test.com/video.mp4",
    });
    mockGetFirstFrame.mockReturnValue(undefined);

    await generateVideo(
      "scene-1",
      "A cat walks across a bridge",
      "Soft footsteps. Wind blowing.",
    );

    expect(mockSeedanceGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A cat walks across a bridge. Audio directions: Soft footsteps. Wind blowing.",
        duration: 5,
        resolution: "720p",
        ratio: "16:9",
      }),
      expect.any(Function),
    );
  });

  it("passes keyframe as first frame when no chaining", async () => {
    mockSeedanceGenerate.mockResolvedValue({
      taskId: "task-123",
      videoUrl: "https://cdn.test.com/video.mp4",
    });

    await generateVideo(
      "scene-0",
      "test visual",
      "test audio",
      undefined,
      "keyframe-base64",
    );

    expect(mockSeedanceGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        firstFrameBase64: "keyframe-base64",
      }),
      expect.any(Function),
    );
  });

  it("uses chaining when sceneIndex and allSceneIds provided", async () => {
    mockGetFirstFrame.mockReturnValue("chained-frame");
    mockSeedanceGenerate.mockResolvedValue({
      taskId: "task-456",
      videoUrl: "https://cdn.test.com/video.mp4",
    });

    await generateVideo(
      "scene-1",
      "test",
      "test",
      undefined,
      "keyframe",
      1,
      ["scene-0", "scene-1"],
    );

    expect(mockGetFirstFrame).toHaveBeenCalledWith(
      "scene-1",
      1,
      ["scene-0", "scene-1"],
      "keyframe",
    );

    expect(mockSeedanceGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        firstFrameBase64: "chained-frame",
      }),
      expect.any(Function),
    );
  });

  it("stores last frame for chaining when returned", async () => {
    mockGetFirstFrame.mockReturnValue(undefined);
    mockSeedanceGenerate.mockResolvedValue({
      taskId: "task-789",
      videoUrl: "https://cdn.test.com/video.mp4",
      lastFrameBase64: "last-frame-data",
    });

    await generateVideo("scene-0", "test", "test");

    expect(mockStoreLastFrame).toHaveBeenCalledWith("scene-0", "last-frame-data");
  });

  it("does not store last frame when chaining is disabled", async () => {
    mockGetFirstFrame.mockReturnValue(undefined);
    mockSeedanceGenerate.mockResolvedValue({
      taskId: "task-789",
      videoUrl: "https://cdn.test.com/video.mp4",
      lastFrameBase64: "last-frame-data",
    });

    await generateVideo(
      "scene-0",
      "test",
      "test",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        duration: 5,
        resolution: "720p",
        aspectRatio: "16:9",
        cameraFixed: false,
        generateAudio: true,
        chainScenes: false, // Disabled
        seed: undefined,
      },
    );

    expect(mockStoreLastFrame).not.toHaveBeenCalled();
  });

  it("returns video as data URI", async () => {
    mockGetFirstFrame.mockReturnValue(undefined);
    mockSeedanceGenerate.mockResolvedValue({
      taskId: "task-123",
      videoUrl: "https://cdn.test.com/video.mp4",
    });

    const result = await generateVideo("scene-0", "test", "test");

    expect(result.sceneId).toBe("scene-0");
    expect(result.videoUrl).toMatch(/^data:video\/mp4;base64,/);
  });

  it("calls onProgress with percent values", async () => {
    mockGetFirstFrame.mockReturnValue(undefined);

    let progressCallback: ((info: { status: string; percent: number }) => void) | undefined;

    mockSeedanceGenerate.mockImplementation(async (_opts, onProgress) => {
      progressCallback = onProgress as (info: { status: string; percent: number }) => void;
      progressCallback?.({ status: "processing", percent: 50 });
      return { taskId: "task-1", videoUrl: "https://cdn.test.com/v.mp4" };
    });

    const onProgress = vi.fn();
    await generateVideo("scene-0", "test", "test", onProgress);

    expect(onProgress).toHaveBeenCalledWith("scene-0", 50);
    expect(onProgress).toHaveBeenCalledWith("scene-0", 100); // Final call
  });

  it("respects custom director settings", async () => {
    mockGetFirstFrame.mockReturnValue(undefined);
    mockSeedanceGenerate.mockResolvedValue({
      taskId: "task-custom",
      videoUrl: "https://cdn.test.com/video.mp4",
    });

    await generateVideo(
      "scene-0",
      "epic scene",
      "dramatic music",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        duration: 10,
        resolution: "1080p",
        aspectRatio: "9:16",
        cameraFixed: true,
        generateAudio: false,
        chainScenes: false,
        seed: 42,
      },
    );

    expect(mockSeedanceGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 10,
        resolution: "1080p",
        ratio: "9:16",
        cameraFixed: true,
        generateAudio: false,
        returnLastFrame: false,
        seed: 42,
      }),
      expect.any(Function),
    );
  });

  it("throws when video download fails", async () => {
    mockGetFirstFrame.mockReturnValue(undefined);
    mockSeedanceGenerate.mockResolvedValue({
      taskId: "task-fail",
      videoUrl: "https://cdn.test.com/broken.mp4",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    await expect(
      generateVideo("scene-0", "test", "test"),
    ).rejects.toThrow("Failed to download video: 404");
  });
});
