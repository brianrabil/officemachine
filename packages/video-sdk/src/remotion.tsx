import { useMemo, type CSSProperties } from "react";
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, useCurrentFrame } from "remotion";
import { TerminalSimulator } from "./components/remocn/terminal-simulator";
import type { Clip, EditorProject } from "./project";

const compositionBackground = { backgroundColor: "#0a0a0a", overflow: "hidden" };
const animatedClipIds = new Set(["accent-card", "eyebrow", "headline", "footer-pill"]);

export interface EditorCompositionProps extends Record<string, unknown> {
  project: EditorProject;
  mediaUrls: Record<string, string>;
}

function VisualClip({ clip, mediaUrls }: { clip: Clip; mediaUrls: Record<string, string> }) {
  const frame = useCurrentFrame();
  const animated = animatedClipIds.has(clip.id);
  const entranceDuration = Math.max(1, Math.min(10, Math.floor(clip.durationInFrames / 3)));
  const entrance = animated
    ? interpolate(frame, [0, entranceDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 1;
  const exit =
    animated && clip.durationInFrames > 12
      ? interpolate(frame, [clip.durationInFrames - 8, clip.durationInFrames - 1], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.cubic),
        })
      : 1;
  const style: CSSProperties = {
    position: "absolute",
    left: clip.x,
    top: clip.y,
    width: clip.width,
    height: clip.height,
    opacity: clip.opacity * entrance * exit,
    translate: `0 ${interpolate(entrance, [0, 1], [48, 0])}px`,
    scale: interpolate(entrance, [0, 1], [0.96, 1]),
    transformOrigin: "center",
  };
  const mediaUrl = clip.mediaId ? mediaUrls[clip.mediaId] : undefined;

  if (clip.kind === "shape") {
    const background =
      clip.id === "background-gradient"
        ? "radial-gradient(circle at 68% 18%, #3f3f46 0, transparent 34%), radial-gradient(circle at 20% 80%, #262626 0, transparent 30%), linear-gradient(135deg, #09090b 0%, #18181b 55%, #09090b 100%)"
        : clip.color;
    return (
      <div
        style={{
          ...style,
          background,
          borderRadius: clip.id === "background-gradient" ? 0 : 56,
          border:
            clip.id === "background-gradient" ? undefined : "2px solid rgba(255,255,255,0.12)",
          boxShadow:
            clip.id === "background-gradient" ? undefined : "0 48px 120px rgba(0,0,0,0.32)",
        }}
      />
    );
  }

  if (clip.kind === "text") {
    const isPill = clip.id === "footer-pill";
    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          padding: isPill ? "0 34px" : 0,
          border: isPill ? "2px solid rgba(255,255,255,0.24)" : undefined,
          borderRadius: isPill ? 999 : undefined,
          background: isPill ? "rgba(255,255,255,0.08)" : undefined,
          color: clip.color,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontSize: clip.fontSize,
          fontWeight: isPill ? 650 : clip.id === "eyebrow" ? 700 : 760,
          letterSpacing: clip.id === "eyebrow" ? "0.16em" : isPill ? "0.08em" : "-0.055em",
          lineHeight: clip.id === "headline" ? 0.92 : 1,
          whiteSpace: "pre-wrap",
          textWrap: "balance",
        }}
      >
        {clip.text}
      </div>
    );
  }

  if (clip.kind === "block") {
    return (
      <div style={style}>
        <div
          style={{
            position: "relative",
            width: 900,
            height: 480,
            scale: `${clip.width / 900} ${clip.height / 480}`,
            transformOrigin: "top left",
          }}
        >
          <Sequence from={-clip.sourceStartFrame} layout="none">
            <TerminalSimulator {...clip.block.props} />
          </Sequence>
        </div>
      </div>
    );
  }

  if (clip.kind === "image" && mediaUrl) {
    return <Img src={mediaUrl} style={{ ...style, objectFit: "cover", borderRadius: 32 }} />;
  }

  if (clip.kind === "video" && mediaUrl) {
    return (
      <Video
        src={mediaUrl}
        trimBefore={clip.sourceStartFrame}
        volume={clip.volume}
        style={{ ...style, objectFit: "cover", borderRadius: 32 }}
      />
    );
  }

  return (
    <div
      style={{
        ...style,
        display: "grid",
        placeItems: "center",
        border: "3px dashed rgba(255,255,255,0.28)",
        borderRadius: 32,
        color: "rgba(255,255,255,0.62)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 32,
      }}
    >
      Media is not available on this device
    </div>
  );
}

export function EditorComposition({ project, mediaUrls }: EditorCompositionProps) {
  const mutedTracks = useMemo(
    () => new Set(project.tracks.filter((track) => track.muted).map((track) => track.id)),
    [project.tracks],
  );

  return (
    <AbsoluteFill style={compositionBackground}>
      {project.clips.map((clip) => {
        if (mutedTracks.has(clip.trackId)) return null;
        if (clip.kind === "audio") {
          const mediaUrl = clip.mediaId ? mediaUrls[clip.mediaId] : undefined;
          if (!mediaUrl) return null;
          return (
            <Sequence
              key={clip.id}
              name={clip.name}
              from={clip.startFrame}
              durationInFrames={clip.durationInFrames}
              premountFor={Math.min(30, clip.startFrame)}
            >
              <Audio src={mediaUrl} trimBefore={clip.sourceStartFrame} volume={clip.volume} />
            </Sequence>
          );
        }

        return (
          <Sequence
            key={clip.id}
            name={clip.name}
            from={clip.startFrame}
            durationInFrames={clip.durationInFrames}
            premountFor={Math.min(30, clip.startFrame)}
          >
            <VisualClip clip={clip} mediaUrls={mediaUrls} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
