import { z } from "zod";

export const clipKindSchema = z.enum(["text", "shape", "video", "image", "audio", "block"]);
export const mediaKindSchema = z.enum(["video", "image", "audio"]);

export const terminalLineSchema = z
  .object({
    text: z.string(),
    type: z.enum(["command", "log", "success", "error"]),
    delay: z.number().int().nonnegative().optional(),
    pause: z.number().int().nonnegative().optional(),
  })
  .strict();

export const terminalSimulatorBlockPropsSchema = z
  .object({
    lines: z.array(terminalLineSchema).min(1),
    prompt: z.string(),
    title: z.string(),
    background: z.string(),
    chromeColor: z.string(),
    fontSize: z.number().positive(),
    charsPerFrame: z.number().positive(),
    chunkSize: z.number().int().positive(),
    speed: z.number().positive(),
  })
  .strict();

export const videoBlockSchema = z
  .object({
    type: z.literal("terminal-simulator"),
    props: terminalSimulatorBlockPropsSchema,
  })
  .strict();

export const compositionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  durationInFrames: z.number().int().positive(),
});

const baseClipSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  name: z.string(),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  sourceStartFrame: z.number().int().nonnegative(),
  mediaId: z.string().nullable(),
  text: z.string(),
  color: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  opacity: z.number().min(0).max(1),
  volume: z.number().min(0).max(1),
  fontSize: z.number().positive(),
});

export const clipSchema = z.discriminatedUnion("kind", [
  baseClipSchema.extend({ kind: z.literal("text"), block: z.never().optional() }),
  baseClipSchema.extend({ kind: z.literal("shape"), block: z.never().optional() }),
  baseClipSchema.extend({ kind: z.literal("video"), block: z.never().optional() }),
  baseClipSchema.extend({ kind: z.literal("image"), block: z.never().optional() }),
  baseClipSchema.extend({ kind: z.literal("audio"), block: z.never().optional() }),
  baseClipSchema.extend({ kind: z.literal("block"), block: videoBlockSchema }),
]);

export const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["visual", "audio"]),
  muted: z.boolean(),
  locked: z.boolean(),
});

export const mediaAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: mediaKindSchema,
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
});

export const editorProjectSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  composition: compositionSchema,
  tracks: z.array(trackSchema),
  clips: z.array(clipSchema),
  media: z.array(mediaAssetSchema),
});

export type ClipKind = z.infer<typeof clipKindSchema>;
export type MediaKind = z.infer<typeof mediaKindSchema>;
export type TerminalLine = z.infer<typeof terminalLineSchema>;
export type TerminalLineType = TerminalLine["type"];
export type TerminalSimulatorBlockProps = z.infer<typeof terminalSimulatorBlockPropsSchema>;
export type VideoBlock = z.infer<typeof videoBlockSchema>;
export type Composition = z.infer<typeof compositionSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type Track = z.infer<typeof trackSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type EditorProject = z.infer<typeof editorProjectSchema>;

export function formatTimecode(frame: number, fps: number): string {
  const safeFrame = Math.max(0, Math.floor(frame));
  const totalSeconds = Math.floor(safeFrame / fps);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frames = safeFrame % Math.round(fps);
  return [hours, minutes, seconds, frames].map((part) => String(part).padStart(2, "0")).join(":");
}
