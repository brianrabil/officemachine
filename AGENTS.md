## Repository

pnpm + Turborepo monorepo (root `package.json` `packageManager: pnpm@11.10.0`).
Workspace is `@workspace/*` internal packages plus several apps. Source for the
agent runtime is AI SDK 7 harness (`@ai-sdk/harness` + Pi adapter +
`just-bash` sandbox). Read `docs/building-an-agent-harness.md` before touching the
harness architecture — it explains the four pieces (`HarnessAgent`, adapter,
sandbox provider, session) and the adapter↔sandbox compatibility constraint.

### Apps (`apps/*`)

- `api` (`@workspace/api`): Nitro + h3 server. **No `src/`** — Nitro auto-routes
  `server/api`, `server/database`, `server/utils`, `server/workflows`. Config at
  root: `nitro.config.ts`, `drizzle.config.ts` (Drizzle/sqlite via `db0`). `h3`
  is pinned to an RC (`2.0.1-rc.22`); verify before bumping.
- `web` (`@workspace/web`): main Next.js chat app. App Router under `app/`
  (no `src/`). `start` uses port **3001**, not 3000.
- `site-legacy` (renamed from `site`): marketing Next.js app (no scope). App
  Router under `app/`. Note `lucide-react` is `^1.23.0` (old major) alongside
  Next 16 / React 19.
- `cli` (`@workspace/cli`): thin wrapper around `@ai-sdk/tui`, importing
  `agent` from `@workspace/agent/agent`. Only script is `cli:dev`.
- `terminal`: a `zero-native` Zig desktop shell (`app.zon`, manifest
  `dev.zero_native.terminal`) wrapping the nested Next.js static-export in
  `apps/terminal/frontend` (output `frontend/out`). Root has **no package.json** —
  it's a Zig project (`zig build dev|run|test|package`). `src/pty.zig` forks
  `$SHELL` via libc `forkpty`; reads are polled on the main thread because
  zero-native bridge calls must run there. See `apps/terminal/README.md` for
  `-Dweb-engine=chromium`, `-Dzero-native-path`, and `ZERO_NATIVE_LOG_*` env.

### Packages (`packages/*`)

- `agent` (`@workspace/agent`): core `HarnessAgent` over Pi (`@ai-sdk/harness-pi`)
  inside a durable `just-bash` sandbox with a `MountableFs` (in-memory base,
  workspace mounted at `/workspace`, sessions at `/.pi-sessions` redirected to
  `APP_CONFIG_DIR/sessions`). Hard-codes
  `dangerouslyAllowFullInternetAccess: true`, `defenseInDepth: false`. Source in
  `lib/`; exports map `"./*": "./lib/*.ts"`. `registry.ts` filters builtin
  providers to only `opencode-go` and `vercel-ai-gateway`.
- `config` (`@workspace/config`): `.env` loader (`@dotenvx/dotenvx` →
  `zod-config`) and JSON5 settings from
  `$APP_CONFIG_DIR/settings.json5`. **Explicit** exports map (subpaths only:
  `./settings`, `./env`, `./files`) — bare `@workspace/config` import will fail.
  Source in `lib/`.
- `ui` (`@workspace/ui`): shared React 19 + shadcn design system. Source in
  **`src/`** (not `lib/`). Imports resolve subpaths: `@workspace/ui/components/*`
  (`.tsx`), `/lib/*`, `/hooks/*`, `/globals.css`, `/postcss.config`.
  `components.json` uses style `base-rhea`, baseColor `neutral`,
  iconLibrary `hugeicons`. Compose `@shadcn/react` and `@base-ui/react` directly.
- `ai-gateway-sdk` (`@workspace/ai-gateway-sdk`) and
  `skills-sdk` (`@workspace/skills-sdk`): **orval-generated** REST SDKs (fetch +
  Zod + SWR) from `openapi/*.yaml`. Never hand-edit `lib/client.ts`,
  `lib/hooks.ts`, `lib/client/*.zod.ts`, or `lib/model/*` — regenerate via
  `pnpm run generate`. They are near-twins; a fix in one likely applies to the
  other.
- `zero-web` (no scope — not a TS package): a Zero (`zerolang`) web framework
  under `packages/zero-web/` — `zero.toml` + `src/{web,items,main}.0`. Routing
  helpers over `std.http` with a `handle()` if/else-chain convention (Zero has
  no function pointers, so there is no runtime router registry). `std.http.listen`
  runs a real loopback socket server inside `zero run`; the runtime discovers
  `handle` by naming convention. **Invoke `zero` by absolute path**
  (`$HOME/.zero/bin/zero run .`) — a bare `zero` on PATH causes the host hook's
  re-exec to fail with `BLD002: zero dump failed`. `zero.graph` is the
  checked-in compile input; rebuild with `zero import .`. Verified against
  `zero 0.3.4` on darwin arm64; install the compiler via
  `curl -fsSL https://zerolang.ai/install.sh | bash`.

### Commands

Root scripts delegate to Turbo: `pnpm run dev`, `pnpm run build`. Lint/format use
oxc: `pnpm run lint` / `pnpm run lint:fix` (oxlint), `pnpm run fmt` /
`pnpm run fmt:check` (oxfmt). Turbo also defines `//#quality` (= lint + format).

Per-app/package scripts: prefer the package script. The npm `dev` script in
`api`, `site-legacy`, `web` runs **portless** (which then launches the real server via
that package's `dev:app`); use `dev:app` to skip portless and hit Next/Nitro
directly. `terminal` and `cli` have no portless layer.

`typecheck` is defined only on `site-legacy`, `ui`, `ai-gateway-sdk`, `skills-sdk`
(all `tsc --noEmit`). Other apps/packages have none — run `tsc --noEmit` in the
package dir if you need it. No package defines a `test` script.

### Conventions and gotchas

- **Two source conventions**: `agent`, `ai-gateway-sdk`, `config`, `skills-sdk`
  put source in `lib/`; `ui` puts it in `src/`. Exports maps reflect this.
- **No build step for packages** despite Turbo's `build` task + `dist/**`
  outputs — packages are consumed as raw `.ts`/`.tsx` via `moduleResolution:
bundler` + `allowImportingTsExtensions`. TS configs use
  `verbatimModuleSyntax` and `noEmit`.
- `@workspace/config` is a runtime dependency of `@workspace/agent`; if its env
  load fails, the agent cannot boot. Both ship a committed `.env`.
- Root `package.json` `overrides` pins `just-bash@^3.0.2`; the
  `InMemoryFs`/`MountableFs`/`ReadWriteFs` types in `agent` come from there.
- `apps/api` recently deleted `server/api/providers/[id].get.ts` and
  `server/api/providers/index.get.ts` (uncommitted) — don't recreate them.
- Harness packages (`@ai-sdk/harness*`, `@ai-sdk/sandbox-*`) are experimental;
  verify against current docs before upgrading.

### `apps/terminal` (wterm + zero-native desktop app)

A zero-native WebView shell (Zig) hosting a Next.js static export that runs the
wterm terminal emulator with `@wterm/just-bash` — an in-browser bash shell. **No
native PTY, no JS bridge, no backend.** Shell execution, file IO, and command
history all run client-side via WASM + just-bash.

- **Frontend**: `apps/terminal/frontend` (Next.js `output: "export"`, output
  `frontend/out`). Build with `bun` (the repo root uses `workspace:*` which
  `npm` rejects). The `zig build run` task does shell out to
  `npm install --workspaces=false` then `npm run build` — that works too.
- **Deps**: `@wterm/{core,dom,react,just-bash}@^0.3.0` and `just-bash@^2.14.2`.
  Pin `just-bash` to `^2.14.2` explicitly — npm `latest` is `3.x`, which does
  **not** satisfy `@wterm/just-bash`'s `peerDependencies: { "just-bash": "^2" }`.
- **`transpilePackages`** in `next.config.ts` is required — the `@wterm/*`
  packages ship untranspiled ESM that Turbopack must process.
- **The `wterm.wasm` binary must ship.** `frontend/package.json`'s `predev`/
  `prebuild` copy `node_modules/@wterm/core/wasm/wterm.wasm` → `public/wterm.wasm`.
  If those scripts vanish (installers sometimes strip them), the terminal renders
  blank with no diagnostic. After any dep change, verify `out/wterm.wasm` exists.
- **Zig shell**: `src/main.zig` is a minimal `App` with `source_fn` only — no
  `start_fn`, no `bridge()`. `src/runner.zig` is the generated runtime wiring
  (do not hand-edit). `app.zon` declares only `webview` capability (no `js_bridge`).
- **Pattern** (`frontend/app/page.tsx`): `useTerminal()` → `{ ref, write }`;
  construct `new BashShell({ files, greeting })` in `onReady`; call
  `shell.attach(write)`; route `onData` to `shell.handleInput(data)`.
- To launch: `cd apps/terminal/frontend && bun install && bun run build && cd .. && zig build && ./zig-out/bin/terminal`.

## Global Coding Rules

- Do the requested engineering work directly. Do not turn tasks into process,
  roadmap, ticketing, or scope-management exercises unless the user asks.
- Do not add wrapper components, wrapping functions, helper factories, barrels,
  alias layers, adapter objects, section primitives, normalization helpers, or
  utility files/functions unless the user explicitly asks or there are at least
  three real call sites with the same behavior.
- Prefer direct imports from concrete files and inline one-off transforms at the
  call site.
- Use library primitives directly. Before building behavior from scratch, check
  the repo stack, installed package docs, or local source for the supported API.
- Let mature libraries own established hard interaction and state problems,
  especially drag-and-drop, resize and selection geometry, subscriptions, and
  persistence coordination. Do not replace their edge-case handling with
  hand-rolled implementations.
- For unfamiliar or drift-prone libraries, SDKs, tools, or platform features,
  read official docs or local source/examples before changing code.
- Parse unknown input once at module boundaries with Zod. Do not scatter repeated
  validation checks through internal code after a boundary parse succeeds.
- Do not add defensive boilerplate, broad try/catch blocks, speculative guards,
  compatibility paths, placeholder layers, retry loops, or silent error
  swallowing. Fail fast and fix the source contract.
- Fallbacks are only allowed in config.
- Use shadcn or TermCN registry primitives for UI surfaces when those components
  are the requested UI stack. Do not recreate look-alike controls locally.
- App frontends must import `@workspace/ui/globals.css` without redefining its
  theme tokens or adding a local color palette. Compose the repository's
  Base UI-backed shadcn components directly; do not add Radix primitives.
- In the video editor canvas, use `react-moveable` for selection, dragging,
  resizing, bounds, and snapping. Do not hand-roll pointer-capture geometry or
  resize handles.
- The video editor's target desktop architecture is a native-rendered `UiApp`
  shell with a Zig `Model` as the sole authority for saved or undoable editor
  state. Scene-declared child WebViews driven by `Options.web_panes` host the
  interaction-heavy Copilot, Remotion canvas, Pierre project tree, and timeline
  surfaces. Web state may cache an authoritative snapshot and hold transient
  gesture, playback, scroll, focus, streaming, and object-URL state only. Do not
  keep Zustand and Zig as competing project stores.
- Keep the working full-window React workspace as the migration and
  browser/registry shell until Zig authority and mixed-pane synchronization are
  proven. Its geometry uses the shared shadcn `ResizablePanelGroup`; Project and
  Copilot span the full workspace height while Canvas and Timeline split only the
  center column. In a future native cutout shell, Native SDK layout owns the
  outer geometry and must not compete with a second web layout owner.
- Reusable video behavior belongs in `@workspace/video-sdk`, but the desktop's
  canonical project validation, edit application, history, revisioning, and
  persistence must run in Zig. TypeScript keeps the shared wire schemas,
  read-only WebView projection, transient playback helpers, IndexedDB media
  primitive, Remotion composition, and web render path. Pin the Zig and
  TypeScript wire contract with shared JSON fixtures instead of maintaining two
  production reducers.
- Native video-editor components follow the Native SDK's use/theme/eject/build
  order. Keep unique chrome inline; extract a markup template only after three
  real call sites repeat the same subtree, use a slot for caller-owned content,
  and style through token references rather than raw colors. Use a Zig view
  function only when the closed markup grammar cannot express the component.
  Eject only SDK-listed composites, and do not confuse the ejectable activity
  `timeline` with the editor's NLE timeline. Templates and Zig view functions
  compose existing widgets; they do not replace missing engine-level input
  behavior such as a vertical splitter.
- Video editor panel headers must use quiet professional editor chrome: compact
  single-line titles and restrained actions. Do not decorate panel headers or
  the main toolbar with status badges, redundant subtitles, or pill-shaped
  labels when spacing, borders, or plain text already communicate hierarchy.
- The video editor project explorer must use `@pierre/trees` from
  `https://trees.software/docs` directly for the file-tree model, rendering,
  focus, selection, expansion, and keyboard behavior. Do not substitute a
  homegrown tree or another headless tree library.
- Disable browser/WebView overscroll on both the video editor timeline surface
  and its scroll container with CSS `overscroll-behavior: none`.
- The video editor is AI-native and must use the existing harness agent in
  `apps/api` as its only agent runtime. Do not add an agent loop to the Native
  shell or React frontend. The harness proposes typed, previewable editor
  operations; the Zig model validates and applies accepted operations as one
  undoable transaction after checking the document identity and base revision,
  while the local project remains authoritative.
- When touching a wrong path, delete or replace it end to end instead of adding
  compatibility exports, aliases, fallback branches, or duplicate
  implementations.
- If a change feels like cleanup abstraction, wrapper, adapter, or just a small
  util, stop and ask first.

## User-Specific Hard Rules From Corrections

- When the user corrects an approach, implementation detail, tool choice, UI
  pattern, or coding preference, document the concrete rule in this file during
  the same work session.
- Install and use the library, package, repo, SDK, or docs link the user names.
  Do not replace it with a custom parser, clone, mock, shim, or look-alike.
- The video editor shell uses the shared shadcn `ResizablePanelGroup` directly:
  Project is the full-height left rail, Copilot is the full-height right rail,
  and only the center column splits Canvas over Timeline. Do not reintroduce
  Dockview or let the timeline span underneath the side rails.
- Use `lucide-react` for every app-owned video editor icon, including icons
  passed into shared loading, message-scroller, and toast surfaces. Pierre's
  internal file-type sprite remains owned by `@pierre/trees`; do not replace
  the tree library to force a different sprite implementation.
- No TypeScript casts in application code. Do not write `as string`,
  `response.json() as ...`, `window as ...`, or other assertions to force a
  type. Fix the source contract, use typed APIs, or parse unknown data at the
  boundary with Zod.
- No hacks or tech debt. If the correct implementation cannot be done, say so
  instead of adding a quick fix.
- No slop. Do not declare work done on the strength of logs, process exits, or
  "looks like it dispatched." Verify the actual user-facing behavior before
  claiming success — if a UI renders, see the render; if a terminal echoes, type
  into it and read the echo back. Never claim "works" from a trace alone. If you
  cannot verify the real outcome (e.g. no GUI in this environment), say that
  explicitly and ask the user to confirm, rather than assuring them it works.
- Do not mutate tool objects returned by libraries to attach behavior. If the
  docs do not show behavior through the construction API, do not bolt it on
  after the fact.
- New agent runtime work should build directly on documented AI SDK
  `ToolLoopAgent`, AI SDK UI message/chat APIs, and `bash-tool` primitives.
  Do not add compatibility layers, copied tool loops, custom runtime event
  unions, or custom message/tool reconciliation.
- For AI SDK chat consumption, render `UIMessage.parts` and use documented
  helpers such as `useChat`, `DirectChatTransport`,
  `addToolApprovalResponse`, and `sendAutomaticallyWhen` instead of maintaining
  parallel conversation state.
- Use `bash-tool` skills through `experimental_createSkillTool` and pass its
  returned `files` and `instructions` into `createBashTool` as documented.
- Implement context compaction through AI SDK agent step preparation. Do not
  expose a separate custom compaction helper as application API.
- TermCN TUI work should compose installed TermCN registry components directly
  and only patch generated component code when needed to match Ink documented
  behavior.
- Native SDK native-rendered apps must compose the built-in component catalog
  directly (for example `breadcrumb`, `button-group`, `list`, `panel`, `card`,
  `split`, `switch`, and `status-bar`). Let those components own alignment,
  density, selection, focus, and surface styling instead of approximating them
  with generic `row`/`column` arrangements.
- The file explorer must use the Native SDK's stock components with their default
  styles. Do not pin a theme or override component colors, backgrounds, radii, or
  visual variants; keep badges restrained, avoid dashboard-style inspector cards,
  and do not skin a WebView to imitate the native component catalog.
- Keep Turborepo task logic package-local. Root build/check/dev/test scripts
  should delegate through `turbo run`; interactive TTY entrypoints may call the
  package directly when Turbo drops stdin.
