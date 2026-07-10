import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Player, type PlayerRef } from "@remotion/player";
import { usePinch } from "@use-gesture/react";
import type { ClipChanges } from "@workspace/video-sdk/operations";
import { formatTimecode, type EditorProject } from "@workspace/video-sdk/project";
import { EditorComposition } from "@workspace/video-sdk/remotion";
import { Button } from "@workspace/ui/components/button";
import Moveable from "react-moveable";
import { flushSync } from "react-dom";
import {
  getCurrentFrame,
  getCurrentFrameSource,
  setCurrentFrame,
  subscribeCurrentFrame,
  useCurrentEditorFrame,
} from "../playback-state";

interface StageProps {
  project: EditorProject;
  mediaUrls: Record<string, string>;
  selectedClipId: string | null;
  onSelect: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, changes: ClipChanges) => void;
  onPreviewClip: (clipId: string, changes: ClipChanges) => void;
  onCommitPreview: () => void;
}

interface CanvasOverlayProps {
  project: EditorProject;
  selectedClipId: string | null;
  stageWidth: number;
  onSelect: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, changes: ClipChanges) => void;
  onPreviewClip: (clipId: string, changes: ClipChanges) => void;
  onCommitPreview: () => void;
}

const playerStyle = { width: "100%", height: "100%" };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function CanvasOverlay({
  project,
  selectedClipId,
  stageWidth,
  onSelect,
  onUpdateClip,
  onPreviewClip,
  onCommitPreview,
}: CanvasOverlayProps) {
  const currentFrame = useCurrentEditorFrame();
  const overlayRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);
  const scale = stageWidth > 0 ? stageWidth / project.composition.width : 1;
  const stageHeight = project.composition.height * scale;
  const lockedTracks = useMemo(
    () => new Set(project.tracks.filter((track) => track.locked).map((track) => track.id)),
    [project.tracks],
  );
  const activeClips = useMemo(
    () =>
      project.clips.filter(
        (clip) =>
          clip.kind !== "audio" &&
          currentFrame >= clip.startFrame &&
          currentFrame < clip.startFrame + clip.durationInFrames,
      ),
    [currentFrame, project.clips],
  );
  const selectedClip = activeClips.find((clip) => clip.id === selectedClipId) ?? null;
  const selectedClipLocked = selectedClip ? lockedTracks.has(selectedClip.trackId) : false;
  const moveableTarget = selectedClip ? `[data-stage-clip="${CSS.escape(selectedClip.id)}"]` : null;

  useLayoutEffect(() => {
    moveableRef.current?.updateRect();
  }, [scale]);

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-10 overflow-visible"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelect(null);
      }}
    >
      {activeClips.map((clip) => {
        const locked = lockedTracks.has(clip.trackId);
        return (
          <button
            key={clip.id}
            type="button"
            aria-label={`${clip.name} canvas layer`}
            aria-disabled={locked}
            data-stage-clip={clip.id}
            className="stage-target"
            style={{
              left: clip.x * scale,
              top: clip.y * scale,
              width: clip.width * scale,
              height: clip.height * scale,
              cursor: locked ? "default" : "move",
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
              if (selectedClipId === clip.id || locked) {
                onSelect(clip.id);
                return;
              }

              const moveable = moveableRef.current;
              const inputEvent = event.nativeEvent;
              const target = event.currentTarget;
              if (!moveable) {
                flushSync(() => onSelect(clip.id));
                moveableRef.current?.dragStart(inputEvent, target);
                return;
              }

              const targetChanged = moveable.waitToChangeTarget();
              flushSync(() => onSelect(clip.id));
              void targetChanged.then(() => moveable.dragStart(inputEvent, target));
            }}
            onKeyDown={(event) => {
              if (locked) return;
              const distance = event.shiftKey ? 10 : 1;
              if (event.key === "ArrowLeft")
                onUpdateClip(clip.id, {
                  x: clamp(clip.x - distance, 0, project.composition.width - clip.width),
                });
              else if (event.key === "ArrowRight")
                onUpdateClip(clip.id, {
                  x: clamp(clip.x + distance, 0, project.composition.width - clip.width),
                });
              else if (event.key === "ArrowUp")
                onUpdateClip(clip.id, {
                  y: clamp(clip.y - distance, 0, project.composition.height - clip.height),
                });
              else if (event.key === "ArrowDown")
                onUpdateClip(clip.id, {
                  y: clamp(clip.y + distance, 0, project.composition.height - clip.height),
                });
              else return;
              event.preventDefault();
            }}
          />
        );
      })}
      {selectedClip && moveableTarget ? (
        <Moveable
          ref={moveableRef}
          className="editor-moveable"
          target={moveableTarget}
          container={overlayRef.current}
          rootContainer={overlayRef}
          flushSync={flushSync}
          draggable={!selectedClipLocked}
          resizable={!selectedClipLocked}
          origin={false}
          renderDirections={["nw", "n", "ne", "e", "se", "s", "sw", "w"]}
          controlPadding={8}
          linePadding={4}
          snappable
          snapThreshold={6}
          snapDirections={{
            left: true,
            top: true,
            right: true,
            bottom: true,
            center: true,
            middle: true,
          }}
          verticalGuidelines={[0, stageWidth / 2, stageWidth]}
          horizontalGuidelines={[0, stageHeight / 2, stageHeight]}
          isDisplaySnapDigit={false}
          bounds={{ position: "css", left: 0, top: 0, right: 0, bottom: 0 }}
          useResizeObserver
          useMutationObserver
          onDrag={({ target, left, top }) => {
            target.style.left = `${left}px`;
            target.style.top = `${top}px`;
            onPreviewClip(selectedClip.id, {
              x: Math.round(left / scale),
              y: Math.round(top / scale),
            });
          }}
          onDragEnd={({ isDrag }) => {
            if (isDrag) onCommitPreview();
          }}
          onResizeStart={({ setMin, setMax }) => {
            setMin([24 * scale, 24 * scale]);
            setMax([stageWidth, stageHeight]);
          }}
          onResize={({ target, width, height, drag }) => {
            target.style.left = `${drag.left}px`;
            target.style.top = `${drag.top}px`;
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
            onPreviewClip(selectedClip.id, {
              x: Math.round(drag.left / scale),
              y: Math.round(drag.top / scale),
              width: Math.round(width / scale),
              height: Math.round(height / scale),
            });
          }}
          onResizeEnd={({ isDrag }) => {
            if (isDrag) onCommitPreview();
          }}
        />
      ) : null}
    </div>
  );
}

function StageTransport({
  playerRef,
  project,
  playing,
  zoomPercent,
  isFit,
  onFit,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  project: EditorProject;
  playing: boolean;
  zoomPercent: number;
  isFit: boolean;
  onFit: () => void;
}) {
  const currentFrame = useCurrentEditorFrame();
  return (
    <div className="relative flex h-11 shrink-0 items-center justify-center border-t border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <Button
          aria-label={playing ? "Pause preview" : "Play preview"}
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            const player = playerRef.current;
            if (!player) return;
            if (playing) {
              player.pause();
              return;
            }
            player.play();
          }}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <span className="w-28 font-mono text-xs tabular-nums text-foreground">
          {formatTimecode(currentFrame, project.composition.fps)}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {project.composition.width} × {project.composition.height}
        </span>
      </div>
      <div className="absolute right-3 flex items-center gap-1">
        <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
          {zoomPercent}%
        </span>
        <Button size="sm" variant="ghost" disabled={isFit} onClick={onFit}>
          Fit
        </Button>
      </div>
    </div>
  );
}

export function Stage({
  project,
  mediaUrls,
  selectedClipId,
  onSelect,
  onUpdateClip,
  onPreviewClip,
  onCommitPreview,
}: StageProps) {
  const playerRef = useRef<PlayerRef>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const renderedScaleRef = useRef(0);
  const minimumScaleRef = useRef(0);
  const maximumScaleRef = useRef(4);
  const pinchFrameRef = useRef<number | null>(null);
  const centerStageRef = useRef(true);
  const previousViewportSizeRef = useRef({ width: 0, height: 0 });
  const pendingPinchAnchorRef = useRef<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [customScale, setCustomScale] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const inputProps = useMemo(() => ({ project, mediaUrls }), [mediaUrls, project]);
  const fitScale = Math.min(
    Math.max(0, viewportSize.width - 48) / project.composition.width,
    Math.max(0, viewportSize.height - 48) / project.composition.height,
  );
  const renderedScale = customScale ?? fitScale;
  const stageSize = {
    width: Math.max(0, Math.floor(project.composition.width * renderedScale)),
    height: Math.max(0, Math.floor(project.composition.height * renderedScale)),
  };

  useLayoutEffect(() => {
    renderedScaleRef.current = renderedScale;
    minimumScaleRef.current = Math.min(0.05, fitScale);
    maximumScaleRef.current = Math.max(4, fitScale);
  }, [fitScale, renderedScale]);

  useLayoutEffect(() => {
    const pendingAnchor = pendingPinchAnchorRef.current;
    const viewport = viewportRef.current;
    const frame = frameRef.current;
    if (!viewport || !frame) return;

    const previousViewportSize = previousViewportSizeRef.current;
    previousViewportSizeRef.current = viewportSize;

    if (pendingAnchor) {
      pendingPinchAnchorRef.current = null;

      const frameRect = frame.getBoundingClientRect();
      viewport.scrollLeft +=
        frameRect.left + pendingAnchor.x * frameRect.width - pendingAnchor.clientX;
      viewport.scrollTop +=
        frameRect.top + pendingAnchor.y * frameRect.height - pendingAnchor.clientY;
      return;
    }

    if (centerStageRef.current || customScale === null) {
      centerStageRef.current = false;
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
      return;
    }

    viewport.scrollLeft += (viewportSize.width - previousViewportSize.width) / 2;
    viewport.scrollTop += (viewportSize.height - previousViewportSize.height) / 2;
  }, [customScale, renderedScale, stageSize.height, stageSize.width, viewportSize]);

  usePinch(
    ({ active, offset: [scale], origin: [clientX, clientY] }) => {
      if (!active) return;
      const frame = frameRef.current;
      if (!frame) return;
      const frameRect = frame.getBoundingClientRect();
      if (frameRect.width === 0 || frameRect.height === 0) return;

      pendingPinchAnchorRef.current = {
        x: (clientX - frameRect.left) / frameRect.width,
        y: (clientY - frameRect.top) / frameRect.height,
        clientX,
        clientY,
      };
      renderedScaleRef.current = scale;

      if (pinchFrameRef.current !== null) return;
      pinchFrameRef.current = requestAnimationFrame(() => {
        pinchFrameRef.current = null;
        setCustomScale(renderedScaleRef.current);
      });
    },
    {
      target: viewportRef,
      eventOptions: { passive: false },
      preventDefault: true,
      modifierKey: "ctrlKey",
      pinchOnWheel: true,
      from: () => [renderedScaleRef.current, 0],
      scaleBounds: () => ({ min: minimumScaleRef.current, max: maximumScaleRef.current }),
      rubberband: false,
    },
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      setViewportSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (pinchFrameRef.current !== null) cancelAnimationFrame(pinchFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const updateFrame = (event: { detail: { frame: number } }) => {
      setCurrentFrame(event.detail.frame, project.composition.durationInFrames, "player");
    };
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleEnded = () => {
      setPlaying(false);
      const lastFrame = project.composition.durationInFrames - 1;
      player.seekTo(lastFrame);
      setCurrentFrame(lastFrame, project.composition.durationInFrames, "player");
    };
    player.addEventListener("frameupdate", updateFrame);
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);
    return () => {
      player.removeEventListener("frameupdate", updateFrame);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
    };
  }, [project.composition.durationInFrames]);

  useEffect(() => {
    const syncPlayer = () => {
      const player = playerRef.current;
      const frame = getCurrentFrame();
      if (player && getCurrentFrameSource() === "external" && player.getCurrentFrame() !== frame) {
        player.seekTo(frame);
      }
    };
    syncPlayer();
    return subscribeCurrentFrame(syncPlayer);
  }, [project.composition.durationInFrames]);

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <div
        ref={viewportRef}
        className="stage-viewport relative min-h-0 flex-1 overflow-auto"
        role="region"
        aria-label="Canvas viewport"
      >
        <div
          className="flex min-h-full min-w-full items-center justify-center"
          style={{
            width: stageSize.width + viewportSize.width,
            height: stageSize.height + viewportSize.height,
          }}
        >
          <div
            ref={frameRef}
            className="stage-frame"
            style={{ width: stageSize.width, height: stageSize.height }}
          >
            <div className="stage-preview">
              <Player
                ref={playerRef}
                component={EditorComposition}
                inputProps={inputProps}
                durationInFrames={project.composition.durationInFrames}
                compositionWidth={project.composition.width}
                compositionHeight={project.composition.height}
                fps={project.composition.fps}
                controls={false}
                moveToBeginningWhenEnded={false}
                acknowledgeRemotionLicense
                style={playerStyle}
              />
            </div>
            {playing ? null : (
              <CanvasOverlay
                project={project}
                selectedClipId={selectedClipId}
                stageWidth={stageSize.width}
                onSelect={onSelect}
                onUpdateClip={onUpdateClip}
                onPreviewClip={onPreviewClip}
                onCommitPreview={onCommitPreview}
              />
            )}
          </div>
        </div>
      </div>
      <StageTransport
        playerRef={playerRef}
        project={project}
        playing={playing}
        zoomPercent={Math.round(renderedScale * 100)}
        isFit={customScale === null}
        onFit={() => {
          if (pinchFrameRef.current !== null) {
            cancelAnimationFrame(pinchFrameRef.current);
            pinchFrameRef.current = null;
          }
          pendingPinchAnchorRef.current = null;
          centerStageRef.current = true;
          renderedScaleRef.current = fitScale;
          setCustomScale(null);
        }}
      />
    </section>
  );
}
