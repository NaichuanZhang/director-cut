import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { _internals } from "./seedance-client";

const { buildRequestBody, mapApiStatus, estimatePercent, getConfig } = _internals;

// ─── getConfig ──────────────────────────────────────────────────────────────

describe("getConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if SEEDANCE_API_KEY is not set", () => {
    delete process.env.SEEDANCE_API_KEY;
    expect(() => getConfig()).toThrow("SEEDANCE_API_KEY");
  });

  it("returns config with defaults when only API key is set", () => {
    process.env.SEEDANCE_API_KEY = "test-key-123";
    const config = getConfig();
    expect(config.apiKey).toBe("test-key-123");
    expect(config.baseUrl).toBe("https://open.volcengineapi.com");
    expect(config.modelEndpointId).toBe("seedance-2-0-lite-t2v");
  });

  it("respects custom base URL and model endpoint", () => {
    process.env.SEEDANCE_API_KEY = "key";
    process.env.SEEDANCE_BASE_URL = "https://custom.api.com";
    process.env.SEEDANCE_MODEL_ENDPOINT_ID = "custom-model";
    const config = getConfig();
    expect(config.baseUrl).toBe("https://custom.api.com");
    expect(config.modelEndpointId).toBe("custom-model");
  });
});

// ─── buildRequestBody ───────────────────────────────────────────────────────

describe("buildRequestBody", () => {
  const config = {
    apiKey: "test",
    baseUrl: "https://api.test.com",
    modelEndpointId: "test-model",
  };

  it("builds minimal request body with defaults", () => {
    const body = buildRequestBody({ prompt: "A sunset over the ocean" }, config) as Record<string, unknown>;

    expect(body).toHaveProperty("model.endpoint_id", "test-model");
    expect(body).toHaveProperty("content.prompt", "A sunset over the ocean");
    expect(body).toHaveProperty("parameters.duration", 5);
    expect(body).toHaveProperty("parameters.resolution", "720p");
    expect(body).toHaveProperty("parameters.ratio", "16:9");
    expect(body).toHaveProperty("parameters.generate_audio", true);
    expect(body).toHaveProperty("parameters.return_last_frame", false);
  });

  it("includes custom duration and resolution", () => {
    const body = buildRequestBody(
      { prompt: "test", duration: 10, resolution: "1080p" },
      config,
    ) as Record<string, unknown>;

    expect(body).toHaveProperty("parameters.duration", 10);
    expect(body).toHaveProperty("parameters.resolution", "1080p");
  });

  it("includes first frame when provided", () => {
    const body = buildRequestBody(
      { prompt: "test", firstFrameBase64: "base64data" },
      config,
    ) as Record<string, unknown>;

    expect(body).toHaveProperty("content.first_frame", {
      type: "image",
      data: "base64data",
    });
  });

  it("includes last frame when provided", () => {
    const body = buildRequestBody(
      { prompt: "test", lastFrameBase64: "endframe" },
      config,
    ) as Record<string, unknown>;

    expect(body).toHaveProperty("content.last_frame", {
      type: "image",
      data: "endframe",
    });
  });

  it("includes camera_fixed and seed when set", () => {
    const body = buildRequestBody(
      { prompt: "test", cameraFixed: true, seed: 42 },
      config,
    ) as Record<string, unknown>;

    expect(body).toHaveProperty("parameters.camera_fixed", true);
    expect(body).toHaveProperty("parameters.seed", 42);
  });

  it("includes callback_url when provided", () => {
    const body = buildRequestBody(
      { prompt: "test", callbackUrl: "https://my.app/webhook" },
      config,
    ) as Record<string, unknown>;

    expect(body).toHaveProperty("callback_url", "https://my.app/webhook");
  });

  it("sets return_last_frame when enabled", () => {
    const body = buildRequestBody(
      { prompt: "test", returnLastFrame: true },
      config,
    ) as Record<string, unknown>;

    expect(body).toHaveProperty("parameters.return_last_frame", true);
  });

  it("handles all aspect ratios", () => {
    for (const ratio of ["16:9", "9:16", "1:1", "4:3", "3:4"] as const) {
      const body = buildRequestBody({ prompt: "test", ratio }, config) as Record<string, unknown>;
      expect(body).toHaveProperty("parameters.ratio", ratio);
    }
  });
});

// ─── mapApiStatus ───────────────────────────────────────────────────────────

describe("mapApiStatus", () => {
  it("maps queued statuses", () => {
    expect(mapApiStatus("queued")).toBe("queued");
    expect(mapApiStatus("submitted")).toBe("queued");
  });

  it("maps processing statuses", () => {
    expect(mapApiStatus("running")).toBe("processing");
    expect(mapApiStatus("processing")).toBe("processing");
  });

  it("maps rendering status", () => {
    expect(mapApiStatus("rendering")).toBe("rendering");
  });

  it("maps completion statuses", () => {
    expect(mapApiStatus("completed")).toBe("complete");
    expect(mapApiStatus("succeed")).toBe("complete");
  });

  it("maps failure statuses", () => {
    expect(mapApiStatus("failed")).toBe("failed");
    expect(mapApiStatus("error")).toBe("failed");
  });

  it("defaults unknown statuses to processing", () => {
    expect(mapApiStatus("unknown_state")).toBe("processing");
    expect(mapApiStatus("")).toBe("processing");
  });

  it("is case-insensitive", () => {
    expect(mapApiStatus("COMPLETED")).toBe("complete");
    expect(mapApiStatus("Failed")).toBe("failed");
    expect(mapApiStatus("QUEUED")).toBe("queued");
  });
});

// ─── estimatePercent ────────────────────────────────────────────────────────

describe("estimatePercent", () => {
  const maxWait = 300_000; // 5 minutes

  it("returns low percent when queued early", () => {
    const pct = estimatePercent("queued", 5_000, maxWait);
    expect(pct).toBeLessThanOrEqual(10);
    expect(pct).toBeGreaterThanOrEqual(0);
  });

  it("returns moderate percent during processing", () => {
    const pct = estimatePercent("processing", 90_000, maxWait);
    expect(pct).toBeGreaterThanOrEqual(10);
    expect(pct).toBeLessThanOrEqual(60);
  });

  it("returns high percent during rendering", () => {
    const pct = estimatePercent("rendering", 200_000, maxWait);
    expect(pct).toBeGreaterThanOrEqual(60);
    expect(pct).toBeLessThanOrEqual(90);
  });

  it("returns 100 when complete", () => {
    expect(estimatePercent("complete", 100_000, maxWait)).toBe(100);
  });

  it("returns 0 when failed", () => {
    expect(estimatePercent("failed", 50_000, maxWait)).toBe(0);
  });

  it("never exceeds 95 before completion", () => {
    const pct = estimatePercent("rendering", 290_000, maxWait);
    expect(pct).toBeLessThanOrEqual(95);
  });
});
