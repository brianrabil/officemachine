import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { applyEditorOperation, type ClipChanges } from "./operations";
import type { Clip, EditorProject, MediaAsset } from "./project";

export type GeneratedClipKind = "text" | "shape" | "terminal-simulator";

export interface EditorSnapshot {
  project: EditorProject;
  selectedClipId: string | null;
}

export interface EditorStore {
  past: EditorSnapshot[];
  project: EditorProject;
  future: EditorSnapshot[];
  selectedClipId: string | null;
  transactionProject: EditorProject | null;
  commitProject: (project: EditorProject, selectedClipId?: string | null) => void;
  setProjectName: (name: string) => void;
  updateClip: (clipId: string, changes: ClipChanges) => void;
  previewClip: (clipId: string, changes: ClipChanges) => void;
  commitPreview: () => void;
  addMedia: (assets: MediaAsset[]) => void;
  addGeneratedClip: (kind: GeneratedClipKind) => void;
  deleteClip: (clipId: string) => void;
  splitClip: (clipId: string) => void;
  deleteSelected: () => void;
  splitSelected: () => void;
  replaceProject: (project: EditorProject) => void;
  selectClip: (clipId: string | null) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export interface CreateEditorStoreOptions {
  initialProject: EditorProject;
  createProject: () => EditorProject;
  createId: () => string;
  createMediaClip: (options: {
    project: EditorProject;
    asset: MediaAsset;
    currentFrame: number;
    id: string;
  }) => Clip | null;
  createGeneratedClip: (options: {
    project: EditorProject;
    kind: GeneratedClipKind;
    currentFrame: number;
    id: string;
  }) => Clip | null;
  getCurrentFrame: () => number;
  setCurrentFrame: (frame: number, durationInFrames: number) => void;
  persist: (project: EditorProject) => void;
  historyLimit?: number;
}

export function createEditorStore(options: CreateEditorStoreOptions) {
  const historyLimit = options.historyLimit ?? 50;
  const useEditorStore = create<EditorStore>()(
    subscribeWithSelector((set, get) => ({
      past: [],
      project: options.initialProject,
      future: [],
      selectedClipId: null,
      transactionProject: null,
      commitProject: (project, selectedClipId) => {
        set((state) => ({
          past: [
            ...state.past.slice(-(historyLimit - 1)),
            {
              project: state.transactionProject ?? state.project,
              selectedClipId: state.selectedClipId,
            },
          ],
          project,
          future: [],
          selectedClipId: selectedClipId === undefined ? state.selectedClipId : selectedClipId,
          transactionProject: null,
        }));
      },
      setProjectName: (name) => {
        set((state) => ({
          project: applyEditorOperation(state.project, { type: "project.rename", name }),
        }));
      },
      updateClip: (clipId, changes) => {
        const state = get();
        state.commitProject(
          applyEditorOperation(state.project, { type: "clip.update", clipId, changes }),
        );
      },
      previewClip: (clipId, changes) => {
        set((state) => ({
          project: applyEditorOperation(state.project, { type: "clip.update", clipId, changes }),
          transactionProject: state.transactionProject ?? state.project,
        }));
      },
      commitPreview: () => {
        set((state) => {
          if (!state.transactionProject) return state;
          return {
            past: [
              ...state.past.slice(-(historyLimit - 1)),
              { project: state.transactionProject, selectedClipId: state.selectedClipId },
            ],
            future: [],
            transactionProject: null,
          };
        });
      },
      addMedia: (assets) => {
        const state = get();
        const currentFrame = options.getCurrentFrame();
        const clips = assets.flatMap((asset) => {
          const clip = options.createMediaClip({
            project: state.project,
            asset,
            currentFrame,
            id: options.createId(),
          });
          return clip ? [clip] : [];
        });
        if (clips.length === 0) return;
        state.commitProject(
          applyEditorOperation(state.project, { type: "media.add", assets, clips }),
          clips.at(-1)?.id,
        );
      },
      addGeneratedClip: (kind) => {
        const state = get();
        const clipId = options.createId();
        const clip = options.createGeneratedClip({
          project: state.project,
          kind,
          currentFrame: options.getCurrentFrame(),
          id: clipId,
        });
        if (!clip) return;
        state.commitProject(
          applyEditorOperation(state.project, { type: "clip.add", clip }),
          clipId,
        );
      },
      deleteClip: (clipId) => {
        const state = get();
        state.commitProject(
          applyEditorOperation(state.project, { type: "clip.delete", clipId }),
          null,
        );
      },
      splitClip: (clipId) => {
        const state = get();
        const selected = state.project.clips.find((clip) => clip.id === clipId);
        if (!selected) return;
        const currentFrame = options.getCurrentFrame();
        const splitAt = currentFrame - selected.startFrame;
        if (splitAt <= 0 || splitAt >= selected.durationInFrames) return;
        const secondId = options.createId();
        state.commitProject(
          applyEditorOperation(state.project, {
            type: "clip.split",
            clipId,
            frame: currentFrame,
            secondClipId: secondId,
          }),
          secondId,
        );
      },
      deleteSelected: () => {
        const state = get();
        if (state.selectedClipId) state.deleteClip(state.selectedClipId);
      },
      splitSelected: () => {
        const state = get();
        if (state.selectedClipId) state.splitClip(state.selectedClipId);
      },
      replaceProject: (project) => {
        options.setCurrentFrame(0, project.composition.durationInFrames);
        set({
          past: [],
          project,
          future: [],
          selectedClipId: null,
          transactionProject: null,
        });
      },
      selectClip: (clipId) => set({ selectedClipId: clipId }),
      undo: () => {
        set((state) => {
          if (state.transactionProject) {
            return { project: state.transactionProject, transactionProject: null };
          }
          const snapshot = state.past.at(-1);
          if (!snapshot) return state;
          return {
            past: state.past.slice(0, -1),
            project: snapshot.project,
            selectedClipId: snapshot.selectedClipId,
            future: [
              { project: state.project, selectedClipId: state.selectedClipId },
              ...state.future,
            ],
          };
        });
      },
      redo: () => {
        set((state) => {
          const snapshot = state.future[0];
          if (!snapshot || state.transactionProject) return state;
          return {
            past: [...state.past, { project: state.project, selectedClipId: state.selectedClipId }],
            project: snapshot.project,
            selectedClipId: snapshot.selectedClipId,
            future: state.future.slice(1),
          };
        });
      },
      reset: () => {
        const project = options.createProject();
        options.setCurrentFrame(0, project.composition.durationInFrames);
        set((state) => ({
          past: [{ project: state.project, selectedClipId: state.selectedClipId }],
          project,
          future: [],
          selectedClipId: null,
          transactionProject: null,
        }));
      },
    })),
  );

  useEditorStore.subscribe(
    (state) => (state.transactionProject ? null : state.project),
    (project) => {
      if (project) options.persist(project);
    },
    { fireImmediately: true },
  );

  return useEditorStore;
}
