/**
 * Scene Chaining Module
 *
 * Manages visual continuity between scenes by using the last frame
 * of one scene as the first frame of the next.
 */

import { log } from "@/lib/logger";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChainedScene {
  readonly sceneId: string;
  readonly index: number;
  readonly firstFrameBase64?: string;
  readonly lastFrameBase64?: string;
}

export interface SceneChain {
  readonly scenes: readonly ChainedScene[];
}

// ─── In-memory chain store ──────────────────────────────────────────────────

const chainStore = new Map<string, string>();

/**
 * Store the last frame of a scene for chaining to the next scene.
 */
export function storeLastFrame(sceneId: string, lastFrameBase64: string): void {
  chainStore.set(sceneId, lastFrameBase64);
  log.debug("scene_chaining", `Stored last frame for ${sceneId}`, {
    sizeKB: Math.round((lastFrameBase64.length * 0.75) / 1024),
  });
}

/**
 * Retrieve the stored last frame for a scene.
 */
export function getLastFrame(sceneId: string): string | undefined {
  return chainStore.get(sceneId);
}

/**
 * Clear all stored frames (e.g., when starting a new project).
 */
export function clearChainStore(): void {
  chainStore.clear();
  log.debug("scene_chaining", "Chain store cleared");
}

/**
 * Get the first frame for a scene based on the chain.
 * For the first scene, uses the keyframe image.
 * For subsequent scenes, uses the last frame of the previous scene.
 */
export function getFirstFrameForScene(
  sceneId: string,
  sceneIndex: number,
  allSceneIds: readonly string[],
  keyframeBase64?: string,
): string | undefined {
  // First scene: use the keyframe image if available
  if (sceneIndex === 0) {
    return keyframeBase64;
  }

  // Subsequent scenes: try to use the last frame of the previous scene
  const prevSceneId = allSceneIds[sceneIndex - 1];
  if (prevSceneId) {
    const prevLastFrame = getLastFrame(prevSceneId);
    if (prevLastFrame) {
      log.info("scene_chaining", `Using last frame from ${prevSceneId} → ${sceneId}`);
      return prevLastFrame;
    }
  }

  // Fallback: use the keyframe image
  return keyframeBase64;
}

/**
 * Build the chain plan for a set of scenes.
 * Returns which scenes can use chaining and which need keyframes.
 */
export function buildChainPlan(
  sceneIds: readonly string[],
  keyframes: ReadonlyMap<string, string>,
): SceneChain {
  const scenes: ChainedScene[] = sceneIds.map((sceneId, index) => {
    const keyframe = keyframes.get(sceneId);
    const firstFrame = getFirstFrameForScene(sceneId, index, sceneIds, keyframe);
    const lastFrame = getLastFrame(sceneId);

    return {
      sceneId,
      index,
      firstFrameBase64: firstFrame,
      lastFrameBase64: lastFrame,
    };
  });

  log.info("scene_chaining", "Built chain plan", {
    totalScenes: scenes.length,
    chainedCount: scenes.filter((s) => s.index > 0 && s.firstFrameBase64).length,
  });

  return { scenes };
}

// ─── Export for testing ─────────────────────────────────────────────────────

export const _internals = {
  chainStore,
};
