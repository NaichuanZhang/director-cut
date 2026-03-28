"use client";

import { useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import type { Scene } from "@/lib/types";

let sceneCounter = 0;
const nextSceneId = () => `scene-${++sceneCounter}`;

export function useAgent() {
  const store = useProjectStore();

  const sendMessage = useCallback(
    async (input: { type: "audio" | "text"; data: string }) => {
      store.setStreaming(true);
      store.addMessage({
        id: `user-${Date.now()}`,
        role: "user",
        content: input.type === "audio" ? "[Voice message]" : input.data,
        timestamp: Date.now(),
      });

      try {
        const res = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
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
              handleEvent(event, store);
            } catch {
              // skip malformed lines
            }
          }
        }

        // flush remaining
        store.flushStreamingText();
      } catch (err) {
        store.addMessage({
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Unknown"}`,
          timestamp: Date.now(),
        });
      } finally {
        store.setStreaming(false);
      }
    },
    [store],
  );

  return { sendMessage };
}

function handleEvent(
  event: Record<string, unknown>,
  store: ReturnType<typeof useProjectStore.getState>,
) {
  switch (event.type) {
    case "agent_text":
      store.appendStreamingText(event.text as string);
      break;

    case "tool_start":
      store.flushStreamingText();
      store.addMessage({
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
      handleToolResult(event, store);
      break;

    case "tool_progress":
      if (event.sceneId) {
        store.updateScene(event.sceneId as string, {
          videoPct: event.pct as number,
        });
      }
      break;

    case "agent_done":
      store.flushStreamingText();
      break;

    case "error":
      store.flushStreamingText();
      store.addMessage({
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Error: ${event.message}`,
        timestamp: Date.now(),
      });
      break;
  }
}

function handleToolResult(
  event: Record<string, unknown>,
  store: ReturnType<typeof useProjectStore.getState>,
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
    store.setScenes(scenes);
  }

  if (name === "generate_image" && result?.sceneId) {
    store.updateScene(result.sceneId as string, {
      imageUrl: result.imageUrl as string,
      status: "imaging",
    });
  }

  if (name === "generate_video" && result?.sceneId) {
    if (result.error) {
      store.updateScene(result.sceneId as string, { status: "error" });
    } else {
      store.updateScene(result.sceneId as string, {
        videoUrl: result.videoUrl as string,
        videoPct: 100,
        status: "complete",
      });
    }
  }

  if (name === "generate_speech" && result?.sceneId) {
    store.updateScene(result.sceneId as string, {
      audioUrl: result.audioUrl as string,
      status: "complete",
    });
  }
}
