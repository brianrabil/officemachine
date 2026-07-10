import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { createIndexedDbMediaStore } from "@workspace/video-sdk/media-indexeddb";
import { Toaster } from "@workspace/ui/components/sonner";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "../editor-store";
import { downloadProject, hasNativeBridge, openNativeProject, saveNativeProject } from "../native";
import { EditorWorkspace } from "./editor-workspace";
import { EditorToolbar } from "./editor-toolbar";

const mediaStore = createIndexedDbMediaStore({
  databaseName: "officemachine-video-editor",
  storeName: "media",
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export function VideoEditor() {
  const editor = useEditorStore(
    useShallow((state) => ({
      project: state.project,
      selectedClipId: state.selectedClipId,
      canUndo: state.past.length > 0 || state.transactionProject !== null,
      canRedo: state.future.length > 0 && state.transactionProject === null,
      setProjectName: state.setProjectName,
      updateClip: state.updateClip,
      previewClip: state.previewClip,
      commitPreview: state.commitPreview,
      deleteClip: state.deleteClip,
      splitClip: state.splitClip,
      deleteSelected: state.deleteSelected,
      splitSelected: state.splitSelected,
      replaceProject: state.replaceProject,
      selectClip: state.selectClip,
      undo: state.undo,
      redo: state.redo,
    })),
  );
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const mediaUrlsRef = useRef(mediaUrls);
  mediaUrlsRef.current = mediaUrls;
  const native = hasNativeBridge();

  useEffect(() => {
    let active = true;
    let loadedUrls: Record<string, string> = {};
    setMediaUrls({});
    void mediaStore
      .loadMediaUrls(editor.project.media)
      .then((urls) => {
        loadedUrls = urls;
        if (active) setMediaUrls(urls);
        else Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
      })
      .catch((error: unknown) => {
        if (active) toast.error("Could not load local media", { description: errorMessage(error) });
      });
    return () => {
      active = false;
      Object.values(loadedUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [editor.project.media]);

  const openProject = useCallback(async () => {
    try {
      const opened = await openNativeProject();
      if (!opened) return;
      editor.replaceProject(opened.project);
      setProjectPath(opened.path);
      toast.success("Project opened", { description: opened.path });
    } catch (error: unknown) {
      toast.error("Could not open project", { description: errorMessage(error) });
    }
  }, [editor.replaceProject]);

  const saveProject = useCallback(async () => {
    const project = useEditorStore.getState().project;
    try {
      if (!native) {
        downloadProject(project);
        toast.success("Project downloaded");
        return;
      }
      const path = await saveNativeProject(project, projectPath);
      if (!path) return;
      setProjectPath(path);
      toast.success("Project saved", { description: path });
    } catch (error: unknown) {
      toast.error("Could not save project", { description: errorMessage(error) });
    }
  }, [native, projectPath]);

  const exportVideo = useCallback(async () => {
    const project = useEditorStore.getState().project;
    const currentMediaUrls = mediaUrlsRef.current;
    setExporting(true);
    setExportProgress(0);
    try {
      const { renderVideoOnWeb } = await import("@workspace/video-sdk/render-web");
      const blob = await renderVideoOnWeb({
        project,
        mediaUrls: currentMediaUrls,
        onProgress: (progress) => setExportProgress(progress * 100),
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name.toLowerCase().replaceAll(" ", "-")}.mp4`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportProgress(100);
      toast.success("MP4 rendered locally");
    } catch (error: unknown) {
      toast.error("This device could not render the MP4", { description: errorMessage(error) });
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const editingText =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      const primaryModifier = event.metaKey || event.ctrlKey;

      if (primaryModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveProject();
        return;
      }
      if (primaryModifier && event.key.toLowerCase() === "o" && native) {
        event.preventDefault();
        void openProject();
        return;
      }
      if (!editingText && primaryModifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (!editingText && !primaryModifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        editor.splitSelected();
        return;
      }
      if (!editingText && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        editor.deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editor.deleteSelected,
    editor.redo,
    editor.splitSelected,
    editor.undo,
    native,
    openProject,
    saveProject,
  ]);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <EditorToolbar
        projectName={editor.project.name}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        exporting={exporting}
        exportProgress={exportProgress}
        onProjectNameChange={editor.setProjectName}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onExport={exportVideo}
      />

      <main className="min-h-0 flex-1">
        <EditorWorkspace
          project={editor.project}
          mediaUrls={mediaUrls}
          selectedClipId={editor.selectedClipId}
          onSelect={editor.selectClip}
          onUpdateClip={editor.updateClip}
          onPreviewClip={editor.previewClip}
          onCommitPreview={editor.commitPreview}
          onSplitClip={editor.splitClip}
          onDeleteClip={editor.deleteClip}
        />
      </main>
      <Toaster
        theme="system"
        richColors
        position="bottom-right"
        icons={{
          success: <CircleCheckIcon className="size-4" />,
          info: <InfoIcon className="size-4" />,
          warning: <TriangleAlertIcon className="size-4" />,
          error: <CircleXIcon className="size-4" />,
          loading: <LoaderCircleIcon className="size-4 animate-spin" />,
        }}
      />
    </div>
  );
}
