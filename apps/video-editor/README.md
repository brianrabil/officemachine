# OfficeMachine Video

An AI-native, local-first Native SDK video editor built as one full-window React
WebView with Remotion and the workspace shadcn component library. Local editing
remains authoritative; AI sessions and tool execution use the existing harness
agent in `apps/api`.

## Run it

From `apps/video-editor`:

```sh
zig build dev
```

This installs the frontend workspace dependencies, starts Vite at
`http://127.0.0.1:5173`, and launches the Native SDK window.

Run `pnpm --filter @workspace/api dev` in another terminal to enable Copilot at
`https://api.localhost`. The editor itself remains usable when the API is off.

Useful checks:

```sh
pnpm --dir frontend run typecheck
pnpm --dir frontend run build
zig build test
zig build package
```

Enable Native SDK automation for desktop runtime verification:

```sh
zig build dev -Dautomation=true
native automate snapshot
```

The macOS package is written to:

```text
zig-out/package/video-editor-0.1.0-macos-Debug.app
```

The generated build currently defaults to the Native SDK CLI installed at
`/Users/rabilb/.vite-plus/js_runtime/node/24.18.0/lib/node_modules/@native-sdk/cli`.
Override it with `-Dnative-sdk-path=/path/to/native-sdk` when needed.

## Storage

- Project autosave: localStorage
- Imported media: IndexedDB
- Native project files: versioned `.omvideo` JSON through the Zig bridge
- MP4 export: local `@remotion/web-renderer` render
- Panel layout: nested shadcn `ResizablePanelGroup` components
- Project-directory selection: localStorage; `@pierre/trees` renders paths scanned from disk
- Copilot history/session: existing durable harness API

Reusable project behavior is provided by `packages/video-sdk`; this app owns
only the editor-specific UI, starter project, local keys, and Native SDK bridge.

See [the architecture document](../../docs/video-editor-architecture.md) for
the canvas, timeline, state, and native boundary decisions.
