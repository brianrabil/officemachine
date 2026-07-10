import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable";
import type { ClipChanges } from "@workspace/video-sdk/operations";
import type { EditorProject } from "@workspace/video-sdk/project";
import { CopilotPanel } from "./copilot-panel";
import { ProjectExplorer } from "./project-explorer";
import { Stage } from "./stage";
import { Timeline } from "./timeline";

interface EditorWorkspaceProps {
  project: EditorProject;
  mediaUrls: Record<string, string>;
  selectedClipId: string | null;
  onSelect: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, changes: ClipChanges) => void;
  onPreviewClip: (clipId: string, changes: ClipChanges) => void;
  onCommitPreview: () => void;
  onSplitClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
}

export function EditorWorkspace({
  project,
  mediaUrls,
  selectedClipId,
  onSelect,
  onUpdateClip,
  onPreviewClip,
  onCommitPreview,
  onSplitClip,
  onDeleteClip,
}: EditorWorkspaceProps) {
  return (
    <ResizablePanelGroup className="min-h-0" id="editor-shell" orientation="horizontal">
      <ResizablePanel
        id="project-panel"
        defaultSize="18%"
        minSize={220}
        maxSize="32%"
        groupResizeBehavior="preserve-pixel-size"
      >
        <ProjectExplorer />
      </ResizablePanel>

      <ResizableHandle id="project-center-handle" />

      <ResizablePanel id="editor-center" defaultSize="60%" minSize={480}>
        <ResizablePanelGroup id="canvas-timeline" orientation="vertical">
          <ResizablePanel id="canvas-panel" defaultSize="64%" minSize={280}>
            <Stage
              project={project}
              mediaUrls={mediaUrls}
              selectedClipId={selectedClipId}
              onSelect={onSelect}
              onUpdateClip={onUpdateClip}
              onPreviewClip={onPreviewClip}
              onCommitPreview={onCommitPreview}
            />
          </ResizablePanel>

          <ResizableHandle id="canvas-timeline-handle" />

          <ResizablePanel id="timeline-panel" defaultSize="36%" minSize={180} maxSize="70%">
            <div className="timeline-surface h-full min-h-0 overflow-hidden">
              <Timeline
                project={project}
                selectedClipId={selectedClipId}
                onSelect={onSelect}
                onUpdateClip={onUpdateClip}
                onSplitClip={onSplitClip}
                onDeleteClip={onDeleteClip}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>

      <ResizableHandle id="center-copilot-handle" />

      <ResizablePanel
        id="copilot-panel"
        defaultSize="22%"
        minSize={280}
        maxSize="36%"
        groupResizeBehavior="preserve-pixel-size"
      >
        <CopilotPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
