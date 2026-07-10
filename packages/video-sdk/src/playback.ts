import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type PlaybackSource = "external" | "player";

export interface PlaybackPosition {
  frame: number;
  source: PlaybackSource;
}

export interface PlaybackState {
  position: PlaybackPosition;
  setCurrentFrame: (frame: number, durationInFrames: number, source?: PlaybackSource) => void;
}

export interface CreatePlaybackStoreOptions {
  initialFrame?: number;
  initialSource?: PlaybackSource;
}

export function createPlaybackStore(options: CreatePlaybackStoreOptions = {}) {
  const initialFrame = options.initialFrame ?? 0;
  const initialSource = options.initialSource ?? "external";

  return createStore<PlaybackState>()(
    subscribeWithSelector((set, get) => ({
      position: { frame: initialFrame, source: initialSource },
      setCurrentFrame: (frame, durationInFrames, source = "external") => {
        const nextFrame = Math.max(0, Math.min(durationInFrames - 1, Math.round(frame)));
        const current = get().position;
        if (nextFrame === current.frame && source === current.source) return;
        set({ position: { frame: nextFrame, source } });
      },
    })),
  );
}
