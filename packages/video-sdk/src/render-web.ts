import type { EditorProject } from "./project";
import { EditorComposition } from "./remotion";

export interface RenderVideoOnWebOptions {
  project: EditorProject;
  mediaUrls: Record<string, string>;
  compositionId?: string;
  onProgress?: (progress: number) => void;
}

export async function renderVideoOnWeb(options: RenderVideoOnWebOptions): Promise<Blob> {
  const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
  const support = await canRenderMediaOnWeb({
    width: options.project.composition.width,
    height: options.project.composition.height,
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
  });
  if (!support.canRender) {
    throw new Error(support.issues.map((issue) => issue.message).join(" "));
  }

  const { getBlob } = await renderMediaOnWeb({
    composition: {
      id: options.compositionId ?? "officemachine-video",
      component: EditorComposition,
      defaultProps: { project: options.project, mediaUrls: options.mediaUrls },
      durationInFrames: options.project.composition.durationInFrames,
      fps: options.project.composition.fps,
      width: options.project.composition.width,
      height: options.project.composition.height,
    },
    inputProps: { project: options.project, mediaUrls: options.mediaUrls },
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    videoBitrate: "high",
    pageResponsiveness: "high",
    onProgress: ({ progress }) => options.onProgress?.(progress),
  });
  return getBlob();
}
