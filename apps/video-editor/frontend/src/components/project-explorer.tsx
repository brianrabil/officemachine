import { prepareFileTreeInput } from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import {
  CircleAlertIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderTreeIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Separator } from "@workspace/ui/components/separator";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  chooseNativeProjectDirectory,
  hasNativeBridge,
  scanNativeProjectDirectory,
} from "../native";

const storageKey = "officemachine-video-project-directory";

interface ProjectTreeProps {
  paths: string[];
}

function ProjectTree({ paths }: ProjectTreeProps) {
  const preparedInput = useMemo(() => prepareFileTreeInput(paths), [paths]);
  const { model } = useFileTree({
    preparedInput,
    density: "compact",
    flattenEmptyDirectories: false,
    icons: { set: "standard", colored: false },
    initialExpansion: 1,
  });

  useEffect(() => {
    model.resetPaths({ preparedInput });
  }, [model, preparedInput]);

  return (
    <FileTree
      aria-label="Project files"
      className="project-file-tree block size-full min-h-0"
      model={model}
    />
  );
}

export function ProjectExplorer() {
  const native = hasNativeBridge();
  const [rootPath, setRootPath] = useState<string | null>(() => {
    const stored = z.string().trim().min(1).safeParse(localStorage.getItem(storageKey));
    return stored.success ? stored.data : null;
  });
  const [paths, setPaths] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(rootPath !== null && native);
  const [treeError, setTreeError] = useState<string | null>(null);

  useEffect(() => {
    if (!rootPath || paths !== null) return;
    if (!native) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setTreeError(null);
    void scanNativeProjectDirectory(rootPath)
      .then((nextPaths) => {
        if (active) setPaths(nextPaths);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setTreeError(error instanceof Error ? error.message : "The directory could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [native, paths, rootPath]);

  const chooseDirectory = async () => {
    try {
      const path = await chooseNativeProjectDirectory(rootPath);
      if (!path) return;
      setLoading(true);
      setTreeError(null);
      const nextPaths = await scanNativeProjectDirectory(path);
      localStorage.setItem(storageKey, path);
      setRootPath(path);
      setPaths(nextPaths);
    } catch (error: unknown) {
      toast.error("Could not use that project directory", {
        description: error instanceof Error ? error.message : "Choose a directory and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (!rootPath) return;
    try {
      setLoading(true);
      setTreeError(null);
      setPaths(await scanNativeProjectDirectory(rootPath));
    } catch (error: unknown) {
      setTreeError(error instanceof Error ? error.message : "The directory could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card/65">
      <div className="flex h-8 shrink-0 items-center border-b border-border px-3">
        <span className="text-xs font-medium">Project</span>
      </div>
      {rootPath ? (
        <>
          <div className="shrink-0 p-2">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <FolderIcon />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Project directory"
                className="truncate text-xs"
                readOnly
                title={rootPath}
                value={rootPath}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Refresh project tree"
                  disabled={loading || !native}
                  onClick={() => void refresh()}
                >
                  {loading ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
                </InputGroupButton>
                <InputGroupButton
                  aria-label="Change project directory"
                  disabled={!native}
                  onClick={() => void chooseDirectory()}
                >
                  Change
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <Separator />

          <div className="min-h-0 flex-1">
            {treeError ? (
              <Alert className="m-2 w-auto px-3 py-2" variant="destructive">
                <CircleAlertIcon />
                <AlertDescription className="text-xs">{treeError}</AlertDescription>
              </Alert>
            ) : loading && paths === null ? (
              <div className="flex h-24 items-center justify-center" role="status">
                <LoaderCircleIcon className="size-4 animate-spin" aria-label="Loading" />
              </div>
            ) : paths?.length ? (
              <ProjectTree key={rootPath} paths={paths} />
            ) : (
              <Empty className="min-h-48 border-0 px-5 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderOpenIcon />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">This folder is empty</EmptyTitle>
                  <EmptyDescription>
                    Choose another directory or add files on disk.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </>
      ) : (
        <Empty className="min-h-0 flex-1 border-0 px-5 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderTreeIcon />
            </EmptyMedia>
            <EmptyTitle className="text-sm">Set a project directory</EmptyTitle>
            <EmptyDescription>
              Choose a local folder to browse its files without uploading anything.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" disabled={!native} onClick={() => void chooseDirectory()}>
            <FolderOpenIcon data-icon="inline-start" />
            Choose folder
          </Button>
          {!native ? (
            <p className="text-center text-[10px] text-muted-foreground">
              Folder access is available in the desktop app.
            </p>
          ) : null}
        </Empty>
      )}
    </aside>
  );
}
