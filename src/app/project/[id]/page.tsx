"use client";

import { useParams } from "next/navigation";
import { ProjectStoreProvider } from "@/stores/project-store-provider";
import { AppShell } from "@/components/app-shell";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ProjectStoreProvider projectId={id}>
      <AppShell />
    </ProjectStoreProvider>
  );
}
