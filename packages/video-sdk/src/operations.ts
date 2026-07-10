import { z } from "zod";
import {
  clipSchema,
  editorProjectSchema,
  mediaAssetSchema,
  videoBlockSchema,
  type Clip,
  type EditorProject,
} from "./project";

export const clipChangesSchema = z
  .object({
    trackId: z.string().optional(),
    name: z.string().optional(),
    startFrame: z.number().int().nonnegative().optional(),
    durationInFrames: z.number().int().positive().optional(),
    sourceStartFrame: z.number().int().nonnegative().optional(),
    mediaId: z.string().nullable().optional(),
    text: z.string().optional(),
    color: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    opacity: z.number().min(0).max(1).optional(),
    volume: z.number().min(0).max(1).optional(),
    fontSize: z.number().positive().optional(),
    block: videoBlockSchema.optional(),
  })
  .strict();

const renameProjectOperationSchema = z
  .object({
    type: z.literal("project.rename"),
    name: z.string(),
  })
  .strict();

const updateClipOperationSchema = z
  .object({
    type: z.literal("clip.update"),
    clipId: z.string(),
    changes: clipChangesSchema,
  })
  .strict();

const addClipOperationSchema = z
  .object({
    type: z.literal("clip.add"),
    clip: clipSchema,
  })
  .strict();

const deleteClipOperationSchema = z
  .object({
    type: z.literal("clip.delete"),
    clipId: z.string(),
  })
  .strict();

const splitClipOperationSchema = z
  .object({
    type: z.literal("clip.split"),
    clipId: z.string(),
    frame: z.number().int().nonnegative(),
    secondClipId: z.string(),
  })
  .strict();

const addMediaOperationSchema = z
  .object({
    type: z.literal("media.add"),
    assets: z.array(mediaAssetSchema),
    clips: z.array(clipSchema),
  })
  .strict();

export const editorOperationSchema = z.discriminatedUnion("type", [
  renameProjectOperationSchema,
  updateClipOperationSchema,
  addClipOperationSchema,
  deleteClipOperationSchema,
  splitClipOperationSchema,
  addMediaOperationSchema,
]);

export const editorTransactionSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    operations: z.array(editorOperationSchema).min(1),
  })
  .strict();

export type ClipChanges = z.infer<typeof clipChangesSchema>;
export type EditorOperation = z.infer<typeof editorOperationSchema>;
export type EditorTransaction = z.infer<typeof editorTransactionSchema>;

function validateClipReferences(project: EditorProject, clip: Clip): void {
  const track = project.tracks.find((candidate) => candidate.id === clip.trackId);
  if (!track) throw new Error(`Clip "${clip.id}" references missing track "${clip.trackId}".`);
  if (clip.kind === "audio" && track.kind !== "audio") {
    throw new Error(`Audio clip "${clip.id}" must be placed on an audio track.`);
  }
  if (clip.kind !== "audio" && track.kind !== "visual") {
    throw new Error(`Visual clip "${clip.id}" must be placed on a visual track.`);
  }
  if (clip.startFrame + clip.durationInFrames > project.composition.durationInFrames) {
    throw new Error(`Clip "${clip.id}" extends beyond the composition duration.`);
  }
  if (clip.kind === "video" || clip.kind === "image" || clip.kind === "audio") {
    if (!clip.mediaId) throw new Error(`Media clip "${clip.id}" is missing a media reference.`);
    const media = project.media.find((asset) => asset.id === clip.mediaId);
    if (!media) throw new Error(`Clip "${clip.id}" references missing media "${clip.mediaId}".`);
    if (media.kind !== clip.kind) {
      throw new Error(`Clip "${clip.id}" and media "${media.id}" have different kinds.`);
    }
  }
}

function validateProject(project: EditorProject): EditorProject {
  const parsed = editorProjectSchema.parse(project);
  for (const collection of [parsed.tracks, parsed.clips, parsed.media]) {
    const ids = new Set<string>();
    for (const item of collection) {
      if (ids.has(item.id)) throw new Error(`Duplicate project id "${item.id}".`);
      ids.add(item.id);
    }
  }
  for (const clip of parsed.clips) validateClipReferences(parsed, clip);
  return parsed;
}

export function applyEditorOperation(
  project: EditorProject,
  operation: EditorOperation,
): EditorProject {
  const currentProject = validateProject(project);
  const currentOperation = editorOperationSchema.parse(operation);
  let nextProject: EditorProject;

  switch (currentOperation.type) {
    case "project.rename":
      nextProject = { ...currentProject, name: currentOperation.name };
      break;
    case "clip.update": {
      const clip = currentProject.clips.find(
        (candidate) => candidate.id === currentOperation.clipId,
      );
      if (!clip) throw new Error(`Cannot update missing clip "${currentOperation.clipId}".`);
      const updatedClip = clipSchema.parse({ ...clip, ...currentOperation.changes });
      nextProject = {
        ...currentProject,
        clips: currentProject.clips.map((candidate) =>
          candidate.id === currentOperation.clipId ? updatedClip : candidate,
        ),
      };
      break;
    }
    case "clip.add":
      if (currentProject.clips.some((clip) => clip.id === currentOperation.clip.id)) {
        throw new Error(`Cannot add duplicate clip "${currentOperation.clip.id}".`);
      }
      nextProject = {
        ...currentProject,
        clips: [...currentProject.clips, currentOperation.clip],
      };
      break;
    case "clip.delete":
      if (!currentProject.clips.some((clip) => clip.id === currentOperation.clipId)) {
        throw new Error(`Cannot delete missing clip "${currentOperation.clipId}".`);
      }
      nextProject = {
        ...currentProject,
        clips: currentProject.clips.filter((clip) => clip.id !== currentOperation.clipId),
      };
      break;
    case "clip.split": {
      const selected = currentProject.clips.find((clip) => clip.id === currentOperation.clipId);
      if (!selected) throw new Error(`Cannot split missing clip "${currentOperation.clipId}".`);
      if (currentProject.clips.some((clip) => clip.id === currentOperation.secondClipId)) {
        throw new Error(`Cannot split to duplicate clip "${currentOperation.secondClipId}".`);
      }
      const splitAt = currentOperation.frame - selected.startFrame;
      if (splitAt <= 0 || splitAt >= selected.durationInFrames) {
        throw new Error(`Split frame must be inside clip "${currentOperation.clipId}".`);
      }
      nextProject = {
        ...currentProject,
        clips: currentProject.clips.flatMap((clip) =>
          clip.id === selected.id
            ? [
                { ...clip, durationInFrames: splitAt },
                {
                  ...clip,
                  id: currentOperation.secondClipId,
                  name: `${clip.name} cut`,
                  startFrame: currentOperation.frame,
                  durationInFrames: clip.durationInFrames - splitAt,
                  sourceStartFrame: clip.sourceStartFrame + splitAt,
                },
              ]
            : [clip],
        ),
      };
      break;
    }
    case "media.add": {
      const mediaIds = new Set(currentProject.media.map((asset) => asset.id));
      for (const asset of currentOperation.assets) {
        if (mediaIds.has(asset.id)) throw new Error(`Cannot add duplicate media "${asset.id}".`);
        mediaIds.add(asset.id);
      }
      const clipIds = new Set(currentProject.clips.map((clip) => clip.id));
      for (const clip of currentOperation.clips) {
        if (clipIds.has(clip.id)) throw new Error(`Cannot add duplicate clip "${clip.id}".`);
        clipIds.add(clip.id);
      }
      nextProject = {
        ...currentProject,
        media: [...currentProject.media, ...currentOperation.assets],
        clips: [...currentProject.clips, ...currentOperation.clips],
      };
      break;
    }
  }

  return validateProject(nextProject);
}

export function applyEditorOperations(
  project: EditorProject,
  operations: readonly EditorOperation[],
): EditorProject {
  return operations.reduce(applyEditorOperation, project);
}

export function applyEditorTransaction(
  project: EditorProject,
  transaction: EditorTransaction,
): EditorProject {
  return applyEditorOperations(project, transaction.operations);
}
