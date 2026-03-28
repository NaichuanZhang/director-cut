import { createStore } from "zustand/vanilla";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Scene, Message } from "@/lib/types";
import { idbStorage } from "@/lib/idb-storage";

interface PersistedState {
  readonly scenes: readonly Scene[];
  readonly messages: readonly Message[];
}

export interface ProjectState {
  readonly scenes: readonly Scene[];
  readonly messages: readonly Message[];
  readonly isStreaming: boolean;
  readonly isRecording: boolean;
  readonly isPlaying: boolean;
  readonly skipVideo: boolean;
  readonly currentSceneIndex: number;
  readonly streamingText: string;

  setScenes: (scenes: readonly Scene[]) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  addMessage: (msg: Message) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  appendStreamingText: (text: string) => void;
  flushStreamingText: () => void;
  setStreaming: (v: boolean) => void;
  setRecording: (v: boolean) => void;
  setPlaying: (v: boolean) => void;
  setSkipVideo: (v: boolean) => void;
  setCurrentSceneIndex: (i: number) => void;
  reset: () => void;
}

let msgCounter = 0;
const nextMsgId = () => `msg-${++msgCounter}-${Date.now()}`;

export type ProjectStore = ReturnType<typeof createProjectStore>;

const storeCache = new Map<string, ProjectStore>();

function createProjectStore(projectId: string) {
  return createStore<ProjectState>()(
    persist(
      (set, get) => ({
        scenes: [],
        messages: [],
        isStreaming: false,
        isRecording: false,
        isPlaying: false,
        skipVideo: false,
        currentSceneIndex: 0,
        streamingText: "",

        setScenes: (scenes) => set({ scenes }),

        updateScene: (id, patch) =>
          set({
            scenes: get().scenes.map((s) =>
              s.id === id ? { ...s, ...patch } : s,
            ),
          }),

        addMessage: (msg) => set({ messages: [...get().messages, msg] }),

        updateMessage: (id, patch) =>
          set({
            messages: get().messages.map((m) =>
              m.id === id ? { ...m, ...patch } : m,
            ),
          }),

        appendStreamingText: (text) =>
          set({ streamingText: get().streamingText + text }),

        flushStreamingText: () => {
          const text = get().streamingText;
          if (!text) return;
          set({
            streamingText: "",
            messages: [
              ...get().messages,
              {
                id: nextMsgId(),
                role: "assistant",
                content: text,
                timestamp: Date.now(),
              },
            ],
          });
        },

        setStreaming: (isStreaming) => set({ isStreaming }),
        setRecording: (isRecording) => set({ isRecording }),
        setPlaying: (isPlaying) => set({ isPlaying }),
        setSkipVideo: (skipVideo) => set({ skipVideo }),
        setCurrentSceneIndex: (currentSceneIndex) => set({ currentSceneIndex }),

        reset: () =>
          set({
            scenes: [],
            messages: [],
            isStreaming: false,
            isRecording: false,
            isPlaying: false,
            skipVideo: false,
            currentSceneIndex: 0,
            streamingText: "",
          }),
      }),
      {
        name: `saycut-project-${projectId}`,
        storage: createJSONStorage<PersistedState>(() => idbStorage),
        partialize: (state): PersistedState => ({
          scenes: state.scenes,
          messages: state.messages,
        }),
      },
    ),
  );
}

export function getProjectStore(projectId: string): ProjectStore {
  const cached = storeCache.get(projectId);
  if (cached) return cached;

  const store = createProjectStore(projectId);
  storeCache.set(projectId, store);
  return store;
}
