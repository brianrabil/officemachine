import assert from "node:assert/strict";
import test from "node:test";
import { applyEditorOperations } from "../src/operations";
import { createPlaybackStore } from "../src/playback";
import { editorProjectSchema, type EditorProject } from "../src/project";
import { createEditorStore } from "../src/store";

function project(): EditorProject {
  return {
    version: 1,
    name: "Test cut",
    composition: { width: 1920, height: 1080, fps: 30, durationInFrames: 120 },
    tracks: [
      { id: "visual", name: "Visual", kind: "visual", muted: false, locked: false },
      { id: "audio", name: "Audio", kind: "audio", muted: false, locked: false },
    ],
    clips: [
      {
        id: "title",
        trackId: "visual",
        name: "Title",
        kind: "text",
        startFrame: 10,
        durationInFrames: 60,
        sourceStartFrame: 0,
        mediaId: null,
        text: "Hello",
        color: "#ffffff",
        x: 100,
        y: 100,
        width: 800,
        height: 200,
        opacity: 1,
        volume: 1,
        fontSize: 80,
      },
    ],
    media: [],
  };
}

test("applies an immutable, ordered edit batch", () => {
  const before = project();
  const after = applyEditorOperations(before, [
    { type: "project.rename", name: "Second cut" },
    {
      type: "clip.update",
      clipId: "title",
      changes: { text: "A better title", startFrame: 20 },
    },
    { type: "clip.split", clipId: "title", frame: 40, secondClipId: "title-cut" },
  ]);

  assert.equal(before.name, "Test cut");
  assert.equal(before.clips.length, 1);
  assert.equal(after.name, "Second cut");
  assert.deepEqual(
    after.clips.map((clip) => [clip.id, clip.startFrame, clip.durationInFrames]),
    [
      ["title", 20, 20],
      ["title-cut", 40, 40],
    ],
  );
  assert.equal(after.clips[1]?.sourceStartFrame, 20);
});

test("rejects invalid editor operations without mutating the input", () => {
  const before = project();
  assert.throws(
    () => applyEditorOperations(before, [{ type: "clip.delete", clipId: "missing" }]),
    /missing clip/,
  );
  assert.throws(
    () =>
      applyEditorOperations(before, [
        { type: "clip.split", clipId: "title", frame: 10, secondClipId: "cut" },
      ]),
    /inside clip/,
  );
  assert.equal(before.clips.length, 1);
});

test("validates, updates, and splits a terminal simulator block", () => {
  const before = editorProjectSchema.parse({
    ...project(),
    composition: { width: 1920, height: 1080, fps: 30, durationInFrames: 360 },
    clips: [
      ...project().clips,
      {
        id: "terminal",
        trackId: "visual",
        name: "Terminal simulator",
        kind: "block",
        startFrame: 30,
        durationInFrames: 250,
        sourceStartFrame: 0,
        mediaId: null,
        text: "",
        color: "#ffffff",
        x: 510,
        y: 300,
        width: 900,
        height: 480,
        opacity: 1,
        volume: 1,
        fontSize: 18,
        block: {
          type: "terminal-simulator",
          props: {
            lines: [{ text: "pnpm test", type: "command" }],
            prompt: "❯",
            title: "~/officemachine",
            background: "#09090b",
            chromeColor: "#18181b",
            fontSize: 18,
            charsPerFrame: 1,
            chunkSize: 2,
            speed: 1,
          },
        },
      },
    ],
  });

  assert.throws(() =>
    editorProjectSchema.parse({
      ...before,
      clips: before.clips.map((clip) =>
        clip.id === "terminal" ? { ...clip, block: undefined } : clip,
      ),
    }),
  );

  const after = applyEditorOperations(before, [
    {
      type: "clip.update",
      clipId: "terminal",
      changes: {
        block: {
          type: "terminal-simulator",
          props: {
            lines: [{ text: "pnpm test", type: "command" }],
            prompt: "❯",
            title: "~/officemachine",
            background: "#09090b",
            chromeColor: "#18181b",
            fontSize: 18,
            charsPerFrame: 1,
            chunkSize: 2,
            speed: 2,
          },
        },
      },
    },
    { type: "clip.split", clipId: "terminal", frame: 120, secondClipId: "terminal-cut" },
  ]);
  const first = after.clips.find((clip) => clip.id === "terminal");
  const second = after.clips.find((clip) => clip.id === "terminal-cut");
  assert.equal(first?.kind, "block");
  assert.equal(second?.kind, "block");
  if (first?.kind !== "block" || second?.kind !== "block") assert.fail("Expected blocks.");
  assert.equal(first.block.props.speed, 2);
  assert.equal(second.block.props.speed, 2);
  assert.equal(second.sourceStartFrame, 90);
});

test("clamps playback and records one history entry for a preview transaction", () => {
  const playback = createPlaybackStore();
  playback.getState().setCurrentFrame(500, 120);
  assert.equal(playback.getState().position.frame, 119);

  const persisted: EditorProject[] = [];
  const useEditorStore = createEditorStore({
    initialProject: project(),
    createProject: project,
    createId: () => "generated",
    createMediaClip: () => null,
    createGeneratedClip: ({ project: currentProject, kind, currentFrame, id }) => {
      if (kind === "terminal-simulator") return null;
      const clip = currentProject.clips[0];
      if (!clip || clip.kind !== "text") return null;
      if (kind === "text") {
        return { ...clip, id, kind: "text", startFrame: currentFrame, text: "Generated" };
      }
      return { ...clip, id, kind: "shape", startFrame: currentFrame, text: "" };
    },
    getCurrentFrame: () => 30,
    setCurrentFrame: (frame, durationInFrames) =>
      playback.getState().setCurrentFrame(frame, durationInFrames),
    persist: (nextProject) => persisted.push(nextProject),
  });

  useEditorStore.getState().previewClip("title", { x: 200 });
  useEditorStore.getState().previewClip("title", { x: 300 });
  assert.equal(useEditorStore.getState().past.length, 0);
  useEditorStore.getState().commitPreview();
  assert.equal(useEditorStore.getState().past.length, 1);
  assert.equal(useEditorStore.getState().project.clips[0]?.x, 300);
  useEditorStore.getState().undo();
  assert.equal(useEditorStore.getState().project.clips[0]?.x, 100);
  assert.ok(persisted.length >= 2);
});
