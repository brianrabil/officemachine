import { z } from "zod";
import { clipSchema, compositionSchema, mediaAssetSchema, trackSchema } from "./project";

export const videoEditorContextSchema = z
  .object({
    composition: compositionSchema,
    tracks: z.array(trackSchema),
    clips: z.array(clipSchema),
    media: z.array(mediaAssetSchema),
    selectedClipId: z.string().nullable(),
    playheadFrame: z.number().int().nonnegative(),
  })
  .strict();

export type VideoEditorContext = z.infer<typeof videoEditorContextSchema>;
