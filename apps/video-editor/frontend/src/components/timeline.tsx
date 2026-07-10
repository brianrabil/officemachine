import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MagnetIcon, ScissorsIcon, Trash2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { usePinch } from "@use-gesture/react";
import type { ClipChanges } from "@workspace/video-sdk/operations";
import { formatTimecode, type Clip, type EditorProject } from "@workspace/video-sdk/project";
import { Button } from "@workspace/ui/components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import { Slider } from "@workspace/ui/components/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { getCurrentFrame, setCurrentFrame, useCurrentEditorFrame } from "../playback-state";

const trackHeaderWidth = 144;
const clipLaneHeight = 36;
const minPixelsPerFrame = 2;
const maxPixelsPerFrame = 12;

interface TimelineDrag {
  clipId: string;
  trackId: string;
  mode: "move" | "trim-start" | "trim-end";
  originClientX: number;
  originScrollLeft: number;
  originalStartFrame: number;
  originalDurationInFrames: number;
  originalSourceStartFrame: number;
  startFrame: number;
  durationInFrames: number;
  sourceStartFrame: number;
}

interface TimelineProps {
  project: EditorProject;
  selectedClipId: string | null;
  onSelect: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, changes: ClipChanges) => void;
  onSplitClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
}

function TimelineReadout({ fps }: { fps: number }) {
  const currentFrame = useCurrentEditorFrame();
  return (
    <span className="absolute left-3 top-1.5 font-mono text-[10px] tabular-nums text-muted-foreground">
      {formatTimecode(currentFrame, fps)}
    </span>
  );
}

function TimelinePlayhead({ pixelsPerFrame }: { pixelsPerFrame: number }) {
  const currentFrame = useCurrentEditorFrame();
  return (
    <div
      className="timeline-playhead"
      style={{ left: trackHeaderWidth + currentFrame * pixelsPerFrame }}
    >
      <div className="timeline-playhead-cap" />
    </div>
  );
}

export function Timeline({
  project,
  selectedClipId,
  onSelect,
  onUpdateClip,
  onSplitClip,
  onDeleteClip,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<TimelineDrag | null>(null);
  const scrubbingRef = useRef(false);
  const pixelsPerFrameRef = useRef(6);
  const pendingZoomAnchorRef = useRef<{ frame: number; viewportX: number } | null>(null);
  const pendingPinchZoomRef = useRef<{ clientX: number; pixelsPerFrame: number } | null>(null);
  const pinchAnimationFrameRef = useRef<number | null>(null);
  const [dragPreview, setDragPreview] = useState<TimelineDrag | null>(null);
  const [pixelsPerFrame, setPixelsPerFrame] = useState(6);
  const [snapping, setSnapping] = useState(true);
  const { fps, durationInFrames } = project.composition;
  const timelineWidth = durationInFrames * pixelsPerFrame;
  const tickStep = Math.max(1, Math.round(fps / (pixelsPerFrame >= 6 ? 2 : 1)));
  const ticks = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(durationInFrames / tickStep) + 1 },
        (_, index) => index * tickStep,
      ),
    [durationInFrames, tickStep],
  );
  const trackLayouts = useMemo(
    () =>
      project.tracks.map((track) => {
        const clips = project.clips
          .filter((clip) => clip.trackId === track.id)
          .slice()
          .sort(
            (left, right) => left.startFrame - right.startFrame || left.id.localeCompare(right.id),
          );
        const laneEnds: number[] = [];
        const lanes = new Map<string, number>();
        clips.forEach((clip) => {
          let lane = laneEnds.findIndex((endFrame) => endFrame <= clip.startFrame);
          if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(clip.startFrame + clip.durationInFrames);
          } else {
            laneEnds[lane] = clip.startFrame + clip.durationInFrames;
          }
          lanes.set(clip.id, lane);
        });
        return { track, clips, lanes, laneCount: Math.max(1, laneEnds.length) };
      }),
    [project.clips, project.tracks],
  );

  useEffect(() => {
    const cancelDrag = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dragRef.current) return;
      dragRef.current = null;
      setDragPreview(null);
    };
    window.addEventListener("keydown", cancelDrag);
    return () => {
      window.removeEventListener("keydown", cancelDrag);
      if (pinchAnimationFrameRef.current !== null) {
        cancelAnimationFrame(pinchAnimationFrameRef.current);
        pinchAnimationFrameRef.current = null;
        pendingPinchZoomRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const anchor = pendingZoomAnchorRef.current;
    pendingZoomAnchorRef.current = null;
    if (!scroll || !anchor) return;

    const nextScrollLeft = trackHeaderWidth + anchor.frame * pixelsPerFrame - anchor.viewportX;
    const maxScrollLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    scroll.scrollLeft = Math.max(0, Math.min(maxScrollLeft, nextScrollLeft));
  }, [pixelsPerFrame]);

  const updateZoom = useCallback((nextValue: number, anchorClientX?: number) => {
    const current = pixelsPerFrameRef.current;
    const next = Math.max(minPixelsPerFrame, Math.min(maxPixelsPerFrame, nextValue));
    if (next === current) return;

    const scroll = scrollRef.current;
    if (scroll) {
      const pendingAnchor = pendingZoomAnchorRef.current;
      const currentScrollLeft = pendingAnchor
        ? trackHeaderWidth + pendingAnchor.frame * current - pendingAnchor.viewportX
        : scroll.scrollLeft;

      if (anchorClientX === undefined) {
        const frame = getCurrentFrame();
        pendingZoomAnchorRef.current = {
          frame,
          viewportX: trackHeaderWidth + frame * current - currentScrollLeft,
        };
      } else {
        const bounds = scroll.getBoundingClientRect();
        const viewportX = Math.max(0, Math.min(scroll.clientWidth, anchorClientX - bounds.left));
        const timeViewportX =
          viewportX <= trackHeaderWidth
            ? trackHeaderWidth + (scroll.clientWidth - trackHeaderWidth) / 2
            : viewportX;
        pendingZoomAnchorRef.current = {
          frame: Math.max(0, (currentScrollLeft + timeViewportX - trackHeaderWidth) / current),
          viewportX: timeViewportX,
        };
      }
    }

    pixelsPerFrameRef.current = next;
    setPixelsPerFrame(next);
  }, []);

  usePinch(
    ({ offset: [nextPixelsPerFrame], origin: [clientX] }) => {
      pendingPinchZoomRef.current = { clientX, pixelsPerFrame: nextPixelsPerFrame };
      if (pinchAnimationFrameRef.current !== null) return;

      pinchAnimationFrameRef.current = requestAnimationFrame(() => {
        pinchAnimationFrameRef.current = null;
        const pendingZoom = pendingPinchZoomRef.current;
        pendingPinchZoomRef.current = null;
        if (pendingZoom) updateZoom(pendingZoom.pixelsPerFrame, pendingZoom.clientX);
      });
    },
    {
      target: scrollRef,
      eventOptions: { passive: false },
      from: () => [pixelsPerFrameRef.current, 0],
      scaleBounds: { min: minPixelsPerFrame, max: maxPixelsPerFrame },
      rubberband: false,
    },
  );

  const seekFromPointer = (clientX: number) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const frame = Math.round(
      (clientX - scroll.getBoundingClientRect().left + scroll.scrollLeft - trackHeaderWidth) /
        pixelsPerFrame,
    );
    setCurrentFrame(frame, durationInFrames);
  };

  const beginScrub = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubbingRef.current = true;
    seekFromPointer(event.clientX);
  };

  const beginDrag = (
    event: React.PointerEvent<HTMLElement>,
    clip: Clip,
    mode: TimelineDrag["mode"],
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const clipElement = event.currentTarget.closest("[data-timeline-clip]");
    if (!(clipElement instanceof HTMLElement)) return;
    clipElement.focus();
    clipElement.setPointerCapture(event.pointerId);
    onSelect(clip.id);
    const draft: TimelineDrag = {
      clipId: clip.id,
      trackId: clip.trackId,
      mode,
      originClientX: event.clientX,
      originScrollLeft: scrollRef.current?.scrollLeft ?? 0,
      originalStartFrame: clip.startFrame,
      originalDurationInFrames: clip.durationInFrames,
      originalSourceStartFrame: clip.sourceStartFrame,
      startFrame: clip.startFrame,
      durationInFrames: clip.durationInFrames,
      sourceStartFrame: clip.sourceStartFrame,
    };
    dragRef.current = draft;
    setDragPreview(draft);
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const scroll = scrollRef.current;
    if (!drag || !scroll) return;

    const scrollBounds = scroll.getBoundingClientRect();
    if (event.clientX < scrollBounds.left + trackHeaderWidth + 32) scroll.scrollLeft -= 12;
    if (event.clientX > scrollBounds.right - 32) scroll.scrollLeft += 12;

    const deltaFrames = Math.round(
      (event.clientX - drag.originClientX + scroll.scrollLeft - drag.originScrollLeft) /
        pixelsPerFrame,
    );
    const targets = [
      0,
      durationInFrames,
      getCurrentFrame(),
      ...project.clips
        .filter((clip) => clip.id !== drag.clipId && clip.trackId === drag.trackId)
        .flatMap((clip) => [clip.startFrame, clip.startFrame + clip.durationInFrames]),
    ];
    const threshold = 7 / pixelsPerFrame;
    const snap = (candidate: number) => {
      if (!snapping || event.altKey) return candidate;
      const nearest = targets.reduce(
        (best, target) =>
          Math.abs(target - candidate) < Math.abs(best - candidate) ? target : best,
        targets[0] ?? candidate,
      );
      return Math.abs(nearest - candidate) <= threshold ? nearest : candidate;
    };

    let startFrame = drag.originalStartFrame;
    let duration = drag.originalDurationInFrames;
    let sourceStartFrame = drag.originalSourceStartFrame;

    if (drag.mode === "move") {
      const candidate = Math.max(
        0,
        Math.min(durationInFrames - duration, drag.originalStartFrame + deltaFrames),
      );
      const snappedStart = snap(candidate);
      const snappedEnd = snap(candidate + duration) - duration;
      startFrame =
        Math.abs(snappedStart - candidate) <= Math.abs(snappedEnd - candidate)
          ? snappedStart
          : snappedEnd;
      startFrame = Math.max(0, Math.min(durationInFrames - duration, startFrame));
    }

    if (drag.mode === "trim-start") {
      const end = drag.originalStartFrame + drag.originalDurationInFrames;
      startFrame = Math.max(0, Math.min(end - 1, snap(drag.originalStartFrame + deltaFrames)));
      duration = end - startFrame;
      sourceStartFrame = Math.max(
        0,
        drag.originalSourceStartFrame + startFrame - drag.originalStartFrame,
      );
    }

    if (drag.mode === "trim-end") {
      const end = Math.max(
        drag.originalStartFrame + 1,
        Math.min(
          durationInFrames,
          snap(drag.originalStartFrame + drag.originalDurationInFrames + deltaFrames),
        ),
      );
      duration = end - drag.originalStartFrame;
    }

    const next = { ...drag, startFrame, durationInFrames: duration, sourceStartFrame };
    dragRef.current = next;
    setDragPreview(next);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (
      drag.startFrame !== drag.originalStartFrame ||
      drag.durationInFrames !== drag.originalDurationInFrames ||
      drag.sourceStartFrame !== drag.originalSourceStartFrame
    ) {
      onUpdateClip(drag.clipId, {
        startFrame: drag.startFrame,
        durationInFrames: drag.durationInFrames,
        sourceStartFrame: drag.sourceStartFrame,
      });
    }
    dragRef.current = null;
    setDragPreview(null);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-card/55">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border/70 px-3">
        <span className="text-xs font-medium">Timeline</span>
        <span className="ml-2 font-mono text-[10px] tabular-nums text-muted-foreground">
          {fps} fps
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={snapping ? "Disable timeline snapping" : "Enable timeline snapping"}
                  aria-pressed={snapping}
                  size="icon-xs"
                  variant={snapping ? "secondary" : "ghost"}
                  onClick={() => setSnapping((value) => !value)}
                >
                  <MagnetIcon />
                </Button>
              }
            />
            <TooltipContent>
              {snapping ? "Snapping on · hold Option to bypass" : "Snapping off"}
            </TooltipContent>
          </Tooltip>
          <Button
            aria-label="Zoom timeline out"
            size="icon-xs"
            variant="ghost"
            onClick={() => updateZoom(pixelsPerFrame - 1)}
          >
            <ZoomOutIcon />
          </Button>
          <Slider
            aria-label="Timeline zoom"
            className="w-24"
            min={minPixelsPerFrame}
            max={maxPixelsPerFrame}
            step={0.1}
            value={pixelsPerFrame}
            onValueChange={(value) => {
              if (typeof value === "number") updateZoom(value);
            }}
          />
          <Button
            aria-label="Zoom timeline in"
            size="icon-xs"
            variant="ghost"
            onClick={() => updateZoom(pixelsPerFrame + 1)}
          >
            <ZoomInIcon />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="timeline-scroll min-h-0 flex-1 overflow-auto">
        <div className="relative min-h-full" style={{ width: trackHeaderWidth + timelineWidth }}>
          <div
            className="timeline-ruler sticky top-0 z-30 h-7 border-b border-border/70 bg-card"
            onPointerDown={beginScrub}
            onPointerMove={(event) => {
              if (scrubbingRef.current) seekFromPointer(event.clientX);
            }}
            onPointerUp={() => {
              scrubbingRef.current = false;
            }}
            onPointerCancel={() => {
              scrubbingRef.current = false;
            }}
          >
            <div
              className="sticky left-0 z-40 h-full border-r border-border/70 bg-card"
              style={{ width: trackHeaderWidth }}
            >
              <TimelineReadout fps={fps} />
            </div>
            {ticks.map((frame) => {
              const major = frame % Math.round(fps) === 0;
              return (
                <div
                  key={frame}
                  className={major ? "timeline-tick timeline-tick-major" : "timeline-tick"}
                  style={{ left: trackHeaderWidth + frame * pixelsPerFrame }}
                >
                  {major ? <span>{Math.round(frame / fps)}s</span> : null}
                </div>
              );
            })}
          </div>

          {trackLayouts.map(({ track, clips, lanes, laneCount }) => (
            <div
              key={track.id}
              data-timeline-track={track.id}
              className="timeline-track-row relative border-b border-border/50"
              style={{ height: laneCount * clipLaneHeight + 8 }}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) seekFromPointer(event.clientX);
              }}
            >
              <div
                className="sticky left-0 z-20 flex h-full items-center gap-2 border-r border-border/70 bg-card px-3"
                style={{ width: trackHeaderWidth }}
              >
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                <span className="truncate text-xs font-medium">{track.name}</span>
                {laneCount > 1 ? (
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                    {laneCount}
                  </span>
                ) : null}
              </div>
              {clips.map((clip) => {
                const preview = dragPreview?.clipId === clip.id ? dragPreview : clip;
                const selected = selectedClipId === clip.id;
                const lane = lanes.get(clip.id) ?? 0;
                return (
                  <ContextMenu key={clip.id}>
                    <ContextMenuTrigger
                      className={
                        selected ? "timeline-clip timeline-clip-selected" : "timeline-clip"
                      }
                      data-kind={clip.kind}
                      data-timeline-clip={clip.id}
                      aria-label={`${clip.name}, ${clip.durationInFrames} frames`}
                      tabIndex={0}
                      style={{
                        left: trackHeaderWidth + preview.startFrame * pixelsPerFrame,
                        top: 5 + lane * clipLaneHeight,
                        width: Math.max(12, preview.durationInFrames * pixelsPerFrame),
                      }}
                      onPointerDown={(event) => beginDrag(event, clip, "move")}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={() => {
                        dragRef.current = null;
                        setDragPreview(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(clip.id);
                          return;
                        }
                        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                        event.preventDefault();
                        const distance = event.shiftKey ? 10 : 1;
                        const direction = event.key === "ArrowLeft" ? -1 : 1;
                        onUpdateClip(clip.id, {
                          startFrame: Math.max(
                            0,
                            Math.min(
                              durationInFrames - clip.durationInFrames,
                              clip.startFrame + direction * distance,
                            ),
                          ),
                        });
                      }}
                    >
                      <button
                        aria-label={`Trim start of ${clip.name}`}
                        type="button"
                        className="timeline-trim timeline-trim-start"
                        onPointerDown={(event) => beginDrag(event, clip, "trim-start")}
                      />
                      <span className="pointer-events-none truncate px-2 text-[11px] font-medium">
                        {clip.name}
                      </span>
                      <button
                        aria-label={`Trim end of ${clip.name}`}
                        type="button"
                        className="timeline-trim timeline-trim-end"
                        onPointerDown={(event) => beginDrag(event, clip, "trim-end")}
                      />
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuGroup>
                        <ContextMenuItem onClick={() => onSplitClip(clip.id)}>
                          <ScissorsIcon />
                          Split at playhead
                          <ContextMenuShortcut>S</ContextMenuShortcut>
                        </ContextMenuItem>
                      </ContextMenuGroup>
                      <ContextMenuSeparator />
                      <ContextMenuGroup>
                        <ContextMenuItem
                          variant="destructive"
                          onClick={() => onDeleteClip(clip.id)}
                        >
                          <Trash2Icon />
                          Delete clip
                          <ContextMenuShortcut>⌫</ContextMenuShortcut>
                        </ContextMenuItem>
                      </ContextMenuGroup>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
          ))}

          <TimelinePlayhead pixelsPerFrame={pixelsPerFrame} />
        </div>
      </div>
    </section>
  );
}
