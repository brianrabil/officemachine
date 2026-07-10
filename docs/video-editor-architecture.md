# Video Editor Architecture

Status: target architecture agreed; the current full-WebView prototype remains
the migration harness.

The desktop editor will use a native-rendered Native SDK `UiApp` for its shell
and canonical state, with WebView cutouts for the surfaces whose mature web
libraries should continue to own difficult interaction or streaming behavior.
The cutouts are projections of the Zig model, not separate editor applications.

## Core decision

Zig owns everything that can be saved, undone, exported, or accepted from the
agent. WebViews own rendering and gesture-local state.

This supersedes the prototype boundary where one full-window React application
and Zustand owned the project. The existing Dockview workspace remains useful:
it lets the authority migration happen without simultaneously replacing the
working layout, timeline resize, canvas, tree, and Copilot surfaces.

## Authority boundary

The Zig model owns source-of-truth state only:

- project document, document identity, and monotonic project revision
- current project path, project directory, dirty state, and save status
- committed selection and committed playhead frame
- undo and redo history
- native panel fractions and the applied timeline height
- media descriptors, but not necessarily large media bytes
- pending agent proposal identity and its base revision

Counts, visible clips, track lanes, timecode strings, enabled command state, and
other computable values are derived when a native view or WebView snapshot is
built. Split fractions and other runtime-applied native values are echoed into
the model through `Msg`, following the Native SDK reconcile contract.

JavaScript may own transient presentation state:

- Remotion `PlayerRef`, active playback ticks, and export progress
- Moveable drag/resize drafts, stage measurements, hover, and focus
- timeline drag/scrub drafts, snapping, zoom, lanes, and horizontal scroll
- Pierre tree expansion, roving focus, virtualization, and loading UI
- AI SDK `useChat` streaming state, prompt draft, and transcript scroll
- IndexedDB media blobs and per-WebView object URLs
- a read-only cache of the latest revisioned Zig snapshot

A gesture can render a local preview at pointer frequency. Pointer-up submits
one typed transaction to Zig. Zig validates the entire transaction, swaps the
project only if every operation succeeds, creates one history entry, increments
the revision once, and returns the new authoritative snapshot. JavaScript never
persists its preview or treats it as the project.

Live playback frames do not need to cross the bridge at 30 or 60 Hz. Canvas and
timeline can share that presentation-only clock on the web side and commit a
stable frame to Zig on seek completion, pause, stop, or end.

## Runtime shape

```text
Native SDK window
  -> native GPU canvas / UiApp
       -> native toolbar, panel chrome, split layout, status, dialogs
       -> Zig Model + Msg + update
       -> Zig project reducer, history, revisions, and persistence
       -> four scene-declared child WebViews
            1. Copilot       AI SDK UI + existing apps/api HarnessAgent
            2. Canvas        Remotion Player + react-moveable
            3. Project tree  @pierre/trees
            4. Timeline      NLE interaction surface

apps/api
  -> existing HarnessAgent and durable chat routes

packages/video-sdk
  -> Zig canonical project/edit module
  -> TypeScript wire schemas and WebView/rendering modules
  -> shared protocol fixtures
```

The installed Native SDK 0.4.1 supports at most four `UiApp` WebView panes, so
these four surfaces fit the current platform budget exactly.

## Native shell and WebView cutouts

The scene declares one full-window `gpu_surface` and four child `.webview`
views, each parented to the canvas. The native view reserves each cutout with an
empty panel carrying a unique semantics label. `Options.web_panes` maps the
scene WebView label to that anchor and derives its URL and reload token from the
model.

Pane geometry is not copied into JavaScript. Native layout computes it, and the
runtime re-snaps each child WebView to its anchor after every rebuild, resize,
and presented frame. The URLs come from one Vite bundle, for example:

```text
zero://app/copilot
zero://app/canvas
zero://app/project-tree
zero://app/timeline
```

In development the same routes resolve below the Vite origin. A canvas-first
`UiApp` must still assign `App.source` from
`native_sdk.frontend.sourceFromEnv(...)`; that installs the packaged
`zero://app` asset source without creating an implicit full-window WebView.

Native components own the fixed shell wherever the current catalog is a good
fit: toolbar buttons, quiet panel headings, nested horizontal splits, status,
dialogs, and ordinary text entry. The WebViews keep the exact libraries already
chosen for the hard surfaces. We do not recreate Moveable, Remotion, Pierre,
AI SDK UI, or timeline gesture behavior in Zig.

## Native component ownership

The native shell follows the SDK's use, theme, eject, or build order:

1. Use an engine built-in when it already owns the interaction contract.
2. Theme it through design tokens when only its appearance needs to change.
3. Build a markup template when three or more call sites repeat the same
   primitive subtree.
4. Use a Zig view function only when the closed markup grammar cannot express
   the shape or its runtime data.
5. Eject an SDK composite only when the editor needs to own that composite's
   structure and the SDK explicitly lists it as ejectable.

The first real editor component should be a repeated pane frame under
`src/components/`: a quiet title row, an optional header-action slot, and an
empty token-styled panel whose semantic label anchors its WebView. Copilot,
canvas, project tree, and timeline all use that same template, so the component
has four real call sites and keeps identical widget identity to inline markup.
Unique chrome such as the main toolbar remains inline until another real use
site exists.

Component markup uses token references such as `surface`, `border`, and
`text_muted`; it never introduces raw colors or a second theme. Imported
component files participate in both hot reload and release compilation: the
same embedded `SourceFile` set feeds `MarkupOptions.sources` and
`CompiledMarkupImports`. `native check` validates the complete import closure,
bindings, messages, accessibility names, and token vocabulary.

The SDK's ejectable `timeline` is a pipeline or activity-ledger composite, not
an NLE track editor. It does not replace the Remotion timeline WebView. Engine
controls such as buttons, text fields, and splitters remain engine-owned and are
themed rather than forked.

Most importantly, a component is composition, not a new input primitive. A
markup template expands to an existing widget tree, and a Zig component still
returns existing widget nodes. Neither can manufacture a vertical divider when
the engine currently exposes only a horizontal `split`. The component system
therefore makes the editor shell clean and distributable, but the vertical
timeline resize still needs native vertical-split support or a library-owned
WebView resize seam.

## Two Native SDK seams to resolve

The mixed-pane primitive is real, but it does not by itself solve the complete
editor contract.

### Vertically resizable full-width timeline

Native SDK `split` is currently horizontal-only, while the accepted timeline
must span the complete window and resize vertically. We will not replace
Dockview's tested divider behavior with a hand-written native pointer loop.

The safe sequence is to retain the full-window Dockview workspace while Zig
authority is introduced, then use one of these supported outcomes before the
final cutover:

1. Native SDK gains a vertical split axis; or
2. the timeline WebView uses a mature resize primitive at its top edge and sends
   the applied height to Zig, which echoes that height into native layout.

The second option needs packaged-app pointer-capture verification before it is
accepted.

### Rich bidirectional pane synchronization

`Options.web_panes` owns frame, URL, and reload reconciliation. It is not a
general state bus. Child WebViews can call the injected bridge, but `UiApp`
does not currently expose a rich bridge-payload-to-`Msg` callback.

An app-specific host seam will:

- parse every bridge request once at the boundary
- turn a valid request into a typed `Msg`
- call `UiApp.dispatch`, never mutate `app_state.model` directly
- return a revisioned snapshot or structured conflict to the calling pane

The installed macOS system-WebView backend's generic window event emitter
targets the main WebView, not the scene-declared child panes. The cutout shell
has no main WebView. For native-originated changes, each child pane therefore
keeps one supported asynchronous bridge subscription open; the host completes
that response for the originating `webview_label` when its relevant revision
changes, and the pane immediately subscribes again. This uses the SDK's
child-targeted async bridge responses instead of polling or maintaining a
second store. If Native SDK adds child-targeted events, the same revision
envelope can move to that primitive.

Bridge payloads are limited to 1 MiB. Project snapshots and transactions may
cross it; imported video and audio bytes may not.

## Revisioned protocol

Every authoritative snapshot carries document and revision identity:

```json
{
  "protocolVersion": 1,
  "documentId": "019...",
  "projectRevision": 42,
  "viewRevision": 108,
  "project": {},
  "selectedClipId": null,
  "committedPlayheadFrame": 75,
  "canUndo": true,
  "canRedo": false,
  "dirty": true
}
```

Every edit transaction includes the document and revision it was prepared
against:

```json
{
  "requestId": "019...",
  "documentId": "019...",
  "baseRevision": 42,
  "transaction": {
    "id": "019...",
    "label": "Move title",
    "operations": []
  }
}
```

A stale document or revision returns a structured conflict and the latest
snapshot. Undo and redo also increment the monotonic project revision; it is a
concurrency version, not a history cursor.

Initial bridge commands:

- `video-editor.state.snapshot`
- `video-editor.state.subscribe`
- `video-editor.transaction.simulate`
- `video-editor.transaction.apply`
- `video-editor.selection.set`
- `video-editor.playhead.commit`
- `video-editor.directory.snapshot`
- `video-editor.directory.refresh`

`simulate` applies an agent proposal or complex edit to a temporary Zig copy
without changing history, persistence, or revisions. Accepting that preview
submits the same transaction through `apply` and creates one undo entry.

## Video SDK boundary

`packages/video-sdk` remains the reusable product boundary, but it becomes a
multi-runtime SDK rather than a Zustand-owned editor.

The Zig side owns:

- canonical project structs and validation
- typed edit operations and atomic transaction application
- undo/redo snapshots and revision rules
- project serialization and local persistence behavior

The TypeScript side owns:

- strict Zod schemas for the shared wire format
- the read-only WebView snapshot client
- transient playback coordination
- IndexedDB media storage while media bytes remain web-owned
- Remotion composition and local web render
- Copilot context and proposal schemas shared with `apps/api`

Only serialization shapes exist in both languages. Mutation semantics are
authoritative in Zig. Shared golden JSON fixtures cover a complete project,
every operation variant, transactions, snapshots, conflicts, and invalid input
so the two parsers cannot drift silently.

## Local-first persistence

Zig loads the starter project and autosave, owns New/Open/Save, and writes the
current model rather than accepting arbitrary replacement JSON from a WebView.
Project writes use a temporary file plus rename so an interruption cannot leave
a partial `.omvideo` document.

Media descriptors live in the project. Large media bytes may remain in
IndexedDB during the authority migration, provided import ordering is explicit:

1. write the blob successfully
2. submit the media/clip transaction to Zig
3. delete the blob if Zig rejects the transaction

Moving media bytes into a native project-data directory is the stronger final
desktop boundary, but it requires a supported streaming or local-URL path; the
JSON bridge must never carry large media files.

## Copilot and HarnessAgent

`apps/api` remains the only agent runtime. The Copilot WebView keeps AI SDK UI
message streaming and renders `UIMessage.parts` directly. Immediately before a
prompt, it pulls the authoritative Zig editor snapshot. HarnessAgent proposals
contain typed Video SDK operations plus `documentId` and `baseRevision`.

The desktop may simulate a proposal for visual review. Accept sends it to Zig;
Zig rejects stale proposals or commits the batch as one undoable transaction.
Media bytes never ride with routine prompts.

## Migration sequence

1. Introduce the Zig model, reducer, history, revisions, and project lifecycle
   while keeping the current single Dockview WebView unchanged visually.
2. Replace the editor's Zustand mutation store with a read-only revisioned
   projection. Route canvas, timeline, toolbar, and agent commits through Zig.
3. Move fixed toolbar, status, and panel chrome into the native `UiApp`.
4. Resolve and verify the vertical timeline resize and child-pane subscription
   seams in a packaged app.
5. Split the one frontend into four routes from the same Vite bundle and anchor
   the four scene-declared WebViews with `Options.web_panes`.
6. Run packaged end-to-end verification for canvas-to-timeline edits, native
   undo, project open/save, project-tree refresh, playback sync, and one real
   HarnessAgent proposal/accept cycle.

This ordering changes one authority boundary at a time and preserves the parts
of the prototype that already work while the Native SDK cutout shell is proven.

## References

- [Native SDK](https://native-sdk.dev/)
- [Native components](https://native-sdk.dev/components)
- [Native SDK canvas preview example](https://github.com/vercel-labs/native/tree/c17c64e4c960de75d962ae942a57047890dc0da0/examples/canvas-preview)
- [Dockview](https://dockview.dev/docs/)
- [Trees, from Pierre](https://trees.software/docs)
- [Remotion Player](https://www.remotion.dev/docs/player)
