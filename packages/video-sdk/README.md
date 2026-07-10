# `@workspace/video-sdk`

Reusable, local-first video editing primitives for OfficeMachine applications.
The package is headless: it owns the document model and deterministic behavior,
while each app owns its UI, starter project, native bridge, and persistence
keys.

## Exports

- `@workspace/video-sdk/project`: project schemas, types, and timecodes
- `@workspace/video-sdk/operations`: validated edit operations and transactions
- `@workspace/video-sdk/store`: configurable Zustand editor store and history
- `@workspace/video-sdk/playback`: vanilla Zustand playback store
- `@workspace/video-sdk/media-indexeddb`: configurable local media blob store
- `@workspace/video-sdk/components/remocn/terminal-simulator`: frame-driven terminal video block
- `@workspace/video-sdk/remotion`: shared Remotion composition
- `@workspace/video-sdk/render-web`: lazy local MP4 renderer
- `@workspace/video-sdk/copilot`: typed editor context for AI consumers

There is intentionally no root barrel. Server code can import project and
Copilot schemas without loading React, Remotion, or browser storage modules.

## Editor store

Create one store per editor surface. The app injects IDs, playhead access,
starter-project creation, persistence, and clip defaults:

```ts
import { createEditorStore } from "@workspace/video-sdk/store";

const useEditorStore = createEditorStore({
  initialProject,
  createProject,
  createId: () => crypto.randomUUID(),
  createMediaClip,
  createGeneratedClip,
  getCurrentFrame,
  setCurrentFrame,
  persist,
});
```

Preview operations remain transient until `commitPreview()` and then create one
undo entry. Imported media bytes stay outside the document; project JSON stores
only stable media descriptors.

## Operations

Operations are Zod-validated, immutable, ordered, and deterministic. Callers
supply every generated ID. Invalid references, incompatible tracks, duplicate
IDs, invalid splits, and clips outside the composition fail before a result is
returned.

```ts
import { applyEditorOperations } from "@workspace/video-sdk/operations";

const nextProject = applyEditorOperations(project, [
  { type: "project.rename", name: "Launch cut" },
  {
    type: "clip.update",
    clipId: "headline",
    changes: { text: "Ship the story." },
  },
]);
```

One accepted Copilot proposal should be one operation batch and one undoable
store transaction. The API proposes operations; the local editor remains the
authority that validates and applies them.

## Video blocks

Block clips store a typed block descriptor inside the project document. The
first block is remocn's terminal simulator, installed through the package-local
shadcn registry configuration and rendered by the shared Remotion composition.
Its commands, output, timing, colors, and terminal title remain ordinary project
data, so local saves, undo, timeline trimming, splitting, previews, and exports
all use the same deterministic source of truth.

## Checks

```sh
pnpm --filter @workspace/video-sdk typecheck
pnpm --filter @workspace/video-sdk test
```
