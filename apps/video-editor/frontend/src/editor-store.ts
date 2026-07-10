import { createEditorStore } from "@workspace/video-sdk/store";
import { getCurrentFrame, setCurrentFrame } from "./playback-state";
import {
  createStarterProject,
  createTerminalSimulatorClip,
  loadLocalProject,
  persistLocalProject,
} from "./project";

export const useEditorStore = createEditorStore({
  initialProject: loadLocalProject(),
  createProject: createStarterProject,
  createId: () => crypto.randomUUID(),
  createMediaClip: ({ project, asset, currentFrame, id }) => {
    const track =
      asset.kind === "audio"
        ? project.tracks.find((candidate) => candidate.kind === "audio")
        : (project.tracks.find(
            (candidate) => candidate.id === "accents" && candidate.kind === "visual",
          ) ??
          project.tracks.find(
            (candidate) => candidate.kind === "visual" && candidate.id !== "background",
          ) ??
          project.tracks.find((candidate) => candidate.kind === "visual"));
    if (!track) return null;
    return {
      id,
      trackId: track.id,
      name: asset.name,
      kind: asset.kind,
      startFrame: currentFrame,
      durationInFrames: Math.min(120, project.composition.durationInFrames - currentFrame),
      sourceStartFrame: 0,
      mediaId: asset.id,
      text: "",
      color: "#fafafa",
      x: 240,
      y: 135,
      width: 1440,
      height: 810,
      opacity: 1,
      volume: 1,
      fontSize: 64,
    };
  },
  createGeneratedClip: ({ project, kind, currentFrame, id }) => {
    const preferredTrackId =
      kind === "text" ? "titles" : kind === "terminal-simulator" ? "blocks" : "accents";
    const track =
      project.tracks.find(
        (candidate) => candidate.id === preferredTrackId && candidate.kind === "visual",
      ) ?? project.tracks.find((candidate) => candidate.kind === "visual");
    if (!track) return null;
    if (kind === "terminal-simulator") {
      return createTerminalSimulatorClip({
        id,
        trackId: track.id,
        startFrame: currentFrame,
        durationInFrames: Math.min(300, project.composition.durationInFrames - currentFrame),
      });
    }
    return {
      id,
      trackId: track.id,
      name: kind === "text" ? "New title" : "Color card",
      kind,
      startFrame: currentFrame,
      durationInFrames: Math.min(90, project.composition.durationInFrames - currentFrame),
      sourceStartFrame: 0,
      mediaId: null,
      text: kind === "text" ? "Type something great" : "",
      color: kind === "text" ? "#fafafa" : "#3f3f46",
      x: kind === "text" ? 320 : 420,
      y: kind === "text" ? 420 : 260,
      width: kind === "text" ? 1280 : 1080,
      height: kind === "text" ? 240 : 560,
      opacity: 1,
      volume: 1,
      fontSize: kind === "text" ? 112 : 64,
    };
  },
  getCurrentFrame,
  setCurrentFrame,
  persist: persistLocalProject,
});
