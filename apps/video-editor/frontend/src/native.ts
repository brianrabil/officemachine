import { z } from "zod";
import { editorProjectSchema, type EditorProject } from "@workspace/video-sdk/project";

declare global {
  interface Window {
    zero?: {
      invoke(command: string, payload?: unknown): Promise<unknown>;
      on(name: string, callback: (detail: unknown) => void): () => void;
    };
  }
}

const openFileResponseSchema = z.array(z.string()).nullable();
const saveFileResponseSchema = z.string().nullable();
const projectPathsSchema = z.array(z.string().min(1));

export function hasNativeBridge(): boolean {
  return window.zero !== undefined;
}

export async function openNativeProject(): Promise<{
  path: string;
  project: EditorProject;
} | null> {
  if (!window.zero) return null;

  const paths = openFileResponseSchema.parse(
    await window.zero.invoke("native-sdk.dialog.openFile", {
      title: "Open video project",
      allowMultiple: false,
      allowDirectories: false,
    }),
  );
  const path = paths?.[0];
  if (!path) return null;

  const contents = z
    .string()
    .parse(await window.zero.invoke("video-editor.project.read", { path }));
  return { path, project: editorProjectSchema.parse(JSON.parse(contents)) };
}

export async function saveNativeProject(
  project: EditorProject,
  existingPath: string | null,
): Promise<string | null> {
  if (!window.zero) return null;

  const selectedPath =
    existingPath ??
    saveFileResponseSchema.parse(
      await window.zero.invoke("native-sdk.dialog.saveFile", {
        title: "Save video project",
        defaultName: `${project.name.toLowerCase().replaceAll(" ", "-")}.omvideo`,
      }),
    );
  if (!selectedPath) return null;
  const path = selectedPath.endsWith(".omvideo") ? selectedPath : `${selectedPath}.omvideo`;

  await window.zero.invoke("video-editor.project.write", {
    path,
    contents: JSON.stringify(project, null, 2),
  });
  return path;
}

export async function chooseNativeProjectDirectory(
  currentPath: string | null,
): Promise<string | null> {
  if (!window.zero) return null;

  const paths = openFileResponseSchema.parse(
    await window.zero.invoke("native-sdk.dialog.openFile", {
      title: "Choose project directory",
      defaultPath: currentPath ?? undefined,
      allowDirectories: true,
      allowMultiple: false,
    }),
  );
  return paths?.[0] ?? null;
}

export async function scanNativeProjectDirectory(path: string): Promise<string[]> {
  if (!window.zero) throw new Error("The project tree is available in the desktop app.");

  return projectPathsSchema.parse(
    await window.zero.invoke("video-editor.directory.scan", { path }),
  );
}

export function downloadProject(project: EditorProject): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name.toLowerCase().replaceAll(" ", "-")}.omvideo`;
  anchor.click();
  URL.revokeObjectURL(url);
}
