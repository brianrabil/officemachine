import { editorProjectSchema, type Clip, type EditorProject } from "@workspace/video-sdk/project";

export function createTerminalSimulatorClip({
  id,
  trackId,
  startFrame,
  durationInFrames,
}: {
  id: string;
  trackId: string;
  startFrame: number;
  durationInFrames: number;
}): Clip {
  return {
    id,
    trackId,
    name: "Terminal simulator",
    kind: "block",
    startFrame,
    durationInFrames,
    sourceStartFrame: 0,
    mediaId: null,
    text: "",
    color: "#fafafa",
    x: 280,
    y: 190,
    width: 1360,
    height: 725,
    opacity: 1,
    volume: 1,
    fontSize: 18,
    block: {
      type: "terminal-simulator",
      props: {
        lines: [
          { text: "pnpm --filter @workspace/video-sdk test", type: "command", delay: 0 },
          { text: "Running deterministic editor tests...", type: "log", delay: 6 },
          { text: "✓ project operations", type: "success", delay: 4 },
          { text: "✓ timeline history", type: "success", delay: 4 },
          { text: "✓ local media contracts", type: "success", delay: 6 },
          {
            text: "pnpm --dir apps/video-editor/frontend build",
            type: "command",
            delay: 10,
          },
          { text: "vite v8.1.3 building for production...", type: "log", delay: 6 },
          { text: "✓ 6179 modules transformed", type: "success", delay: 8 },
          { text: "zig build package -Dautomation=true", type: "command", delay: 10 },
          { text: "OfficeMachine Video.app is ready", type: "success", delay: 12 },
        ],
        prompt: "❯",
        title: "~/Developer/officemachine",
        background: "#09090b",
        chromeColor: "#18181b",
        fontSize: 18,
        charsPerFrame: 1,
        chunkSize: 2,
        speed: 1.55,
      },
    },
  };
}

const starterProject: EditorProject = {
  version: 1,
  name: "First cut",
  composition: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 480,
  },
  tracks: [
    { id: "background", name: "Background", kind: "visual", muted: false, locked: false },
    { id: "titles", name: "Titles", kind: "visual", muted: false, locked: false },
    { id: "accents", name: "Accents", kind: "visual", muted: false, locked: false },
    { id: "blocks", name: "Blocks", kind: "visual", muted: false, locked: false },
    { id: "audio", name: "Audio", kind: "audio", muted: false, locked: false },
  ],
  clips: [
    {
      id: "background-gradient",
      trackId: "background",
      name: "Graphite gradient",
      kind: "shape",
      startFrame: 0,
      durationInFrames: 480,
      sourceStartFrame: 0,
      mediaId: null,
      text: "",
      color: "#18181b",
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      opacity: 1,
      volume: 1,
      fontSize: 64,
    },
    {
      id: "accent-card",
      trackId: "accents",
      name: "Accent card",
      kind: "shape",
      startFrame: 12,
      durationInFrames: 142,
      sourceStartFrame: 0,
      mediaId: null,
      text: "",
      color: "#3f3f46",
      x: 176,
      y: 190,
      width: 1568,
      height: 700,
      opacity: 0.24,
      volume: 1,
      fontSize: 64,
    },
    {
      id: "eyebrow",
      trackId: "titles",
      name: "Eyebrow",
      kind: "text",
      startFrame: 18,
      durationInFrames: 118,
      sourceStartFrame: 0,
      mediaId: null,
      text: "A LOCAL-FIRST STUDIO",
      color: "#d4d4d8",
      x: 304,
      y: 330,
      width: 1312,
      height: 80,
      opacity: 1,
      volume: 1,
      fontSize: 40,
    },
    {
      id: "headline",
      trackId: "titles",
      name: "Headline",
      kind: "text",
      startFrame: 26,
      durationInFrames: 128,
      sourceStartFrame: 0,
      mediaId: null,
      text: "Edit at the speed\nof an idea.",
      color: "#fafafa",
      x: 304,
      y: 430,
      width: 1312,
      height: 300,
      opacity: 1,
      volume: 1,
      fontSize: 132,
    },
    {
      id: "footer-pill",
      trackId: "accents",
      name: "Remotion pill",
      kind: "text",
      startFrame: 54,
      durationInFrames: 100,
      sourceStartFrame: 0,
      mediaId: null,
      text: "REMOTION  •  NATIVE SDK",
      color: "#e4e4e7",
      x: 304,
      y: 790,
      width: 640,
      height: 64,
      opacity: 1,
      volume: 1,
      fontSize: 30,
    },
    createTerminalSimulatorClip({
      id: "terminal-simulator",
      trackId: "blocks",
      startFrame: 180,
      durationInFrames: 300,
    }),
  ],
  media: [],
};

export function createStarterProject(): EditorProject {
  return structuredClone(starterProject);
}

export function loadLocalProject(): EditorProject {
  const stored = localStorage.getItem("officemachine-video-project");
  if (!stored) return createStarterProject();

  try {
    const project = editorProjectSchema.parse(JSON.parse(stored));
    return {
      ...project,
      clips: project.clips.map((clip) => {
        if (clip.id === "background-gradient" && clip.color === "#111827") {
          return {
            ...clip,
            name: clip.name === "Midnight gradient" ? "Graphite gradient" : clip.name,
            color: "#18181b",
          };
        }
        if (clip.id === "accent-card" && clip.color === "#7c3aed") {
          return { ...clip, color: "#3f3f46" };
        }
        if (clip.id === "eyebrow" && clip.color === "#c4b5fd") {
          return { ...clip, color: "#d4d4d8" };
        }
        if (clip.id === "headline" && clip.color === "#f8fafc") {
          return { ...clip, color: "#fafafa" };
        }
        if (clip.id === "footer-pill" && clip.color === "#ddd6fe") {
          return { ...clip, color: "#e4e4e7" };
        }
        return clip;
      }),
    };
  } catch {
    return createStarterProject();
  }
}

export function persistLocalProject(project: EditorProject): void {
  localStorage.setItem("officemachine-video-project", JSON.stringify(project));
}
