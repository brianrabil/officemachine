import { Download, Redo2, Undo2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Progress } from "@workspace/ui/components/progress";
import { Separator } from "@workspace/ui/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { memo } from "react";

interface EditorToolbarProps {
  projectName: string;
  canUndo: boolean;
  canRedo: boolean;
  exporting: boolean;
  exportProgress: number;
  onProjectNameChange: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
}

export const EditorToolbar = memo(function EditorToolbar({
  projectName,
  canUndo,
  canRedo,
  exporting,
  exportProgress,
  onProjectNameChange,
  onUndo,
  onRedo,
  onExport,
}: EditorToolbarProps) {
  return (
    <header className="editor-toolbar flex h-9 shrink-0 items-center gap-1 border-b border-border bg-card px-2">
      <span className="px-1 text-xs font-semibold tracking-tight">Video</span>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Input
        aria-label="Project name"
        className="h-7 w-44 bg-input/35 text-xs"
        value={projectName}
        onChange={(event) => onProjectNameChange(event.target.value)}
      />
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button aria-label="Undo" size="icon-xs" variant="ghost" disabled={!canUndo}>
              <Undo2 />
            </Button>
          }
          onClick={onUndo}
        />
        <TooltipContent>Undo · ⌘Z</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button aria-label="Redo" size="icon-xs" variant="ghost" disabled={!canRedo}>
              <Redo2 />
            </Button>
          }
          onClick={onRedo}
        />
        <TooltipContent>Redo · ⇧⌘Z</TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-2">
        {exporting ? (
          <div className="flex w-36 items-center gap-2" role="status">
            <Progress className="flex-1" value={exportProgress} />
            <span className="w-7 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
              {Math.round(exportProgress)}%
            </span>
          </div>
        ) : null}
        <Button size="sm" onClick={onExport} disabled={exporting}>
          <Download data-icon="inline-start" />
          Export
        </Button>
      </div>
    </header>
  );
});
