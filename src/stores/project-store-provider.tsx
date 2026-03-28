"use client";

import { createContext, useContext, useMemo } from "react";
import { useStore } from "zustand";
import { getProjectStore, type ProjectStore, type ProjectState } from "./project-store";

const ProjectStoreContext = createContext<ProjectStore | null>(null);
const ProjectIdContext = createContext<string>("");

export function ProjectStoreProvider({
  projectId,
  children,
}: {
  readonly projectId: string;
  readonly children: React.ReactNode;
}) {
  const store = useMemo(() => getProjectStore(projectId), [projectId]);

  return (
    <ProjectIdContext value={projectId}>
      <ProjectStoreContext value={store}>
        {children}
      </ProjectStoreContext>
    </ProjectIdContext>
  );
}

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  const store = useContext(ProjectStoreContext);
  if (!store) {
    throw new Error("useProjectStore must be used within ProjectStoreProvider");
  }
  return useStore(store, selector);
}

export function useProjectStoreApi(): ProjectStore {
  const store = useContext(ProjectStoreContext);
  if (!store) {
    throw new Error("useProjectStoreApi must be used within ProjectStoreProvider");
  }
  return store;
}

export function useProjectId(): string {
  return useContext(ProjectIdContext);
}
