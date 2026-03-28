"use client";

import { useCallback } from "react";
import {
  useProjectStoreApi,
  useProjectId,
} from "@/stores/project-store-provider";
import { useProjectsStore } from "@/stores/projects-store";
import type { Scene, Message } from "@/lib/types";
import type { ProjectStore } from "@/stores/project-store";

let sceneCounter = 0;
const nextSceneId = () => `scene-${++sceneCounter}`;

const MAX_HISTORY_MESSAGES = 20;

/** Convert client messages to Bedrock Message[] format for server-side context. */
function buildHistory(
  messages: readonly Message[],
): Array<{ role: "user" | "assistant"; content: Array<{ text: string }> }> {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  const history: Array<{
    role: "user" | "assistant";
    content: Array<{ text: string }>;
  }> = [];

  for (const msg of recent) {
    if (msg.role === "tool") continue;
    if (!msg.content) continue;

    const role = msg.role === "user" ? "user" : "assistant";
    // Strip base64 data URIs from content
    const text = msg.content.replace(/data:[^;]+;base64,[^\s"')]+/g, "[media]");

    // Bedrock requires alternating user/assistant — merge consecutive same-role
    const last = history[history.length - 1];
    if (last && last.role === role) {
      last.content[0].text += "\n" + text;
    } else {
      history.push({ role, content: [{ text }] });
    }
  }

  // Bedrock requires first message to be "user" — trim leading assistant messages
  while (history.length > 0 && history[0].role !== "user") {
    history.shift();
  }

  return history;
}

/**
 * Resolve a scene ID from the LLM (e.g. "1", "scene_1") to the actual
 * client-side scene ID. Tries exact match first, then numeric extraction
 * matched against scene.index.
 */
function resolveSceneId(
  scenes: readonly Scene[],
  sceneId: string,
): string | undefined {
  // Exact match
  const exact = scenes.find((s) => s.id === sceneId);
  if (exact) return exact.id;

  // Extract numeric part and match by 1-based index
  const num = parseInt(sceneId.replace(/\D/g, ""), 10);
  if (!isNaN(num)) {
    // LLM typically uses 1-based: "1" → index 0
    const byOneBased = scenes.find((s) => s.index === num - 1);
    if (byOneBased) return byOneBased.id;
    // Fallback: try 0-based
    const byZeroBased = scenes.find((s) => s.index === num);
    if (byZeroBased) return byZeroBased.id;
  }

  return undefined;
}

export function useAgent() {
  const store = useProjectStoreApi();
  const projectId = useProjectId();

  const sendMessage = useCallback(
    async (input: { type: "audio" | "text"; data: string }) => {
      store.getState().setStreaming(true);
      const userMsgId = `user-${Date.now()}`;
      store.getState().addMessage({
        id: userMsgId,
        role: "user",
        content:
          input.type === "audio" ? "[Transcribing voice...]" : input.data,
        timestamp: Date.now(),
      });

      try {
        const history = buildHistory(store.getState().messages);
        const res = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input, history }),
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            if (!json) continue;

            try {
              const event = JSON.parse(json);
              handleEvent(event, store, projectId, userMsgId);
            } catch {
              // skip malformed lines
            }
          }
        }

        // flush remaining
        store.getState().flushStreamingText();
      } catch (err) {
        store.getState().addMessage({
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Unknown"}`,
          timestamp: Date.now(),
        });
      } finally {
        store.getState().setStreaming(false);
      }
    },
    [store, projectId],
  );

  return { sendMessage };
}

function handleEvent(
  event: Record<string, unknown>,
  store: ProjectStore,
  projectId: string,
  userMsgId: string,
) {
  const s = () => store.getState();

  switch (event.type) {
    case "transcription_done":
      s().updateMessage(userMsgId, { content: event.text as string });
      break;

    case "agent_text":
      s().appendStreamingText(event.text as string);
      break;

    case "tool_start":
      s().flushStreamingText();
      s().addMessage({
        id: `tool-${Date.now()}`,
        role: "tool",
        content: "",
        toolCall: {
          name: event.name as string,
          args: (event.args as Record<string, unknown>) ?? {},
        },
        timestamp: Date.now(),
      });
      break;

    case "tool_done":
      handleToolResult(event, store, projectId);
      break;

    case "tool_progress": {
      const sid = event.sceneId
        ? resolveSceneId(s().scenes, event.sceneId as string)
        : undefined;
      if (sid) {
        s().updateScene(sid, { videoPct: event.pct as number });
      }
      break;
    }

    case "agent_done":
      s().flushStreamingText();
      break;

    case "error":
      s().flushStreamingText();
      s().addMessage({
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Error: ${event.message}`,
        timestamp: Date.now(),
      });
      break;
  }
}

function syncProjectMeta(projectId: string, store: ProjectStore) {
  const scenes = store.getState().scenes;
  useProjectsStore.getState().updateProject(projectId, {
    updatedAt: Date.now(),
    sceneCount: scenes.length,
    thumbnailUrl: scenes.find((s) => s.imageUrl)?.imageUrl ?? null,
  });
}

function handleToolResult(
  event: Record<string, unknown>,
  store: ProjectStore,
  projectId: string,
) {
  const name = event.name as string;
  const result = event.result as Record<string, unknown>;

  if (name === "generate_script" && result?.scenes) {
    const raw = result.scenes as Array<Record<string, string>>;
    const scenes: Scene[] = raw.map((s, i) => ({
      id: nextSceneId(),
      index: i,
      title: s.title ?? `Scene ${i + 1}`,
      narrationText: s.narrationText ?? "",
      visualDescription: s.visualDescription ?? "",
      dialogueDirections: s.dialogueDirections ?? "",
      imageUrl: null,
      videoUrl: null,
      audioUrl: null,
      videoPct: 0,
      status: "scripted",
    }));
    store.getState().setScenes(scenes);

    // Update project meta with title from first scene
    const title = scenes[0]?.title ? `${scenes[0].title}…` : "Untitled Project";
    useProjectsStore.getState().updateProject(projectId, {
      updatedAt: Date.now(),
      sceneCount: scenes.length,
      title,
    });
  }

  if (name === "generate_image" && result?.sceneId) {
    const sid = resolveSceneId(
      store.getState().scenes,
      result.sceneId as string,
    );
    if (sid) {
      store.getState().updateScene(sid, {
        imageUrl: result.imageUrl as string,
        status: "imaging",
      });
      syncProjectMeta(projectId, store);
    }
  }

  if (name === "generate_video" && result?.sceneId) {
    const sid = resolveSceneId(
      store.getState().scenes,
      result.sceneId as string,
    );
    if (sid) {
      if (result.error) {
        store.getState().updateScene(sid, { status: "error" });
      } else {
        store.getState().updateScene(sid, {
          videoUrl: result.videoUrl as string,
          videoPct: 100,
          status: "complete",
        });
      }
      syncProjectMeta(projectId, store);
    }
  }

  if (name === "generate_speech" && result?.sceneId) {
    const sid = resolveSceneId(
      store.getState().scenes,
      result.sceneId as string,
    );
    if (sid) {
      store.getState().updateScene(sid, {
        audioUrl: result.audioUrl as string,
      });
    }
  }
}
