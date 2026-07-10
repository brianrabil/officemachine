import { createPlaybackStore, type PlaybackSource } from "@workspace/video-sdk/playback";
import { useStore } from "zustand";

const playbackStore = createPlaybackStore();

export function getCurrentFrame(): number {
  return playbackStore.getState().position.frame;
}

export function getCurrentFrameSource(): PlaybackSource {
  return playbackStore.getState().position.source;
}

export function setCurrentFrame(
  frame: number,
  durationInFrames: number,
  source: PlaybackSource = "external",
): void {
  playbackStore.getState().setCurrentFrame(frame, durationInFrames, source);
}

export function subscribeCurrentFrame(listener: () => void): () => void {
  return playbackStore.subscribe((state) => state.position, listener);
}

export function useCurrentEditorFrame(): number {
  return useStore(playbackStore, (state) => state.position.frame);
}
