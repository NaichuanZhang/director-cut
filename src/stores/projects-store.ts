import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProjectMeta } from "@/lib/types";
import { idbStorage } from "@/lib/idb-storage";

interface ProjectsPersistedState {
  readonly projects: readonly ProjectMeta[];
}

interface ProjectsState {
  readonly projects: readonly ProjectMeta[];
  readonly hydrated: boolean;

  addProject: (meta: ProjectMeta) => void;
  updateProject: (id: string, patch: Partial<ProjectMeta>) => void;
  removeProject: (id: string) => void;
}

async function migrateLegacyProject() {
  try {
    const raw = await idbStorage.getItem("saycut-project");
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (!state || (!state.scenes?.length && !state.messages?.length)) {
      return;
    }

    const id = crypto.randomUUID();
    const firstScene = state.scenes?.[0];
    const title = firstScene?.title
      ? `${firstScene.title}…`
      : "Untitled Project";

    // Copy data to new per-project key
    await idbStorage.setItem(
      `saycut-project-${id}`,
      JSON.stringify({
        state: { scenes: state.scenes, messages: state.messages },
        version: 0,
      }),
    );

    // Add to project index
    const meta: ProjectMeta = {
      id,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sceneCount: state.scenes?.length ?? 0,
      thumbnailUrl: firstScene?.imageUrl ?? null,
    };

    const indexRaw = await idbStorage.getItem("saycut-projects-index");
    const index = indexRaw
      ? JSON.parse(indexRaw)
      : { state: { projects: [] }, version: 0 };
    index.state.projects = [...(index.state.projects ?? []), meta];
    await idbStorage.setItem("saycut-projects-index", JSON.stringify(index));

    // Remove legacy key
    await idbStorage.removeItem("saycut-project");
  } catch {
    // Migration is best-effort — don't break first load
  }
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      hydrated: false,

      addProject: (meta) => set({ projects: [...get().projects, meta] }),

      updateProject: (id, patch) =>
        set({
          projects: get().projects.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        }),

      removeProject: (id) =>
        set({
          projects: get().projects.filter((p) => p.id !== id),
        }),
    }),
    {
      name: "saycut-projects-index",
      storage: createJSONStorage<ProjectsPersistedState>(() => idbStorage),
      partialize: (state): ProjectsPersistedState => ({
        projects: state.projects,
      }),
      onRehydrateStorage: () => {
        // Called after Zustand's built-in rehydration completes
        return () => {
          migrateLegacyProject().then(async () => {
            // If migration wrote new data, re-read it
            const raw = await idbStorage.getItem("saycut-projects-index");
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                const projects = parsed?.state?.projects ?? [];
                useProjectsStore.setState({ projects, hydrated: true });
                return;
              } catch {
                // fall through
              }
            }
            useProjectsStore.setState({ hydrated: true });
          });
        };
      },
    },
  ),
);
