# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

pnpm + Turborepo monorepo (`packageManager: pnpm@11.10.0`). Workspaces are
`apps/*` and `packages/*` (see `pnpm-workspace.yaml`; `apps/terminal/frontend`
is explicitly excluded — it's built with `bun`, not pnpm). Packages are
consumed as raw `.ts`/`.tsx` via `moduleResolution: bundler` +
`allowImportingTsExtensions` — there is **no build step** for `packages/*`
despite Turbo defining a `build` task with `dist/**` outputs.

### Commands

- `pnpm run dev` / `pnpm run build` — delegate to `turbo run dev` / `build`
  across the workspace.
- `pnpm run lint` / `lint:fix` — oxlint. `pnpm run fmt` / `fmt:check` — oxfmt.
  Turbo also defines `//#quality` (lint + format) and `//#quality:fix`.
- **Typecheck** (`tsc --noEmit`) is only defined as a package script in
  `apps/site-legacy`, `packages/ui`, `packages/tui` — it's not a Turbo task, so run it
  directly: `pnpm --filter <pkg> run typecheck`. Other packages have no
  typecheck script; run `tsc --noEmit` in the package dir if needed.
- **Tests**: only `apps/cli` defines a `test` script (`xo && ava`). No other
  package has one.
- Per-app dev: `apps/api`, `apps/web`, `apps/site-legacy`'s `dev` script runs
  **portless** (a port-manager wrapper), which launches the real server via
  that package's `dev:app`. Use `dev:app` directly (`nitro dev` / `next dev`)
  to skip portless. `apps/cli` and `apps/terminal` have no portless layer.
  `apps/web`'s `start` binds port **3001**, not 3000.
- `apps/terminal` is a Zig project with **no package.json at its root** — use
  `zig build dev|run|test|package`. Its Next.js frontend
  (`apps/terminal/frontend`) is built separately with `bun` (`bun install &&
  bun run build`); the repo root's `workspace:*` protocol breaks under `npm`.
- `packages/zero-web` runs via the `zero` compiler — invoke it by **absolute
  path** (`$HOME/.zero/bin/zero run .`); a bare `zero` on PATH breaks the host
  hook's re-exec (`BLD002: zero dump failed`).

## Architecture

This is an AI SDK 7 **harness** stack (`@ai-sdk/harness` + a Pi runtime
adapter + a sandbox provider), not a hand-rolled tool loop. `docs/building-an-agent-harness.md`
explains the harness concepts in depth (`HarnessAgent` / adapter / sandbox /
session) and is worth reading before touching this area — but its concrete
file references are from an earlier layout (a single `chat.post.ts`, a
`packages/agent/lib/{registry,paths,durable-just-bash,session-store,chat-id}.ts`
split, `apps/cli/src/main.ts`) that the code has since moved past. The
sections below describe the **current** shape.

### Core: `packages/agent`

`lib/harness.ts` (not `agent.ts` — renamed) constructs the singleton `agent`
(a `HarnessAgent`) at module scope: a Pi adapter (`createPi`, model from
`@workspace/config/settings`) over a real sandbox from
`@workspace/omni-sandbox`'s `createOmniSandbox` — a local Apple `container`
sandbox (`@workspace/apple-sandbox`) in dev, `@ai-sdk/sandbox-vercel` when
deployed on Vercel (auto-detected via `process.env.VERCEL`). `just-bash` was
the original in-process sandbox backend; it's gone from this path — it
structurally cannot support bridge-backed harness adapters (no real process
execution or networking), so it was replaced once the Apple `container`
sandbox was built out. The Apple backend bind-mounts the real checkout at
`/workspace`, with `/workspace/.pi-sessions` as a second, nested mount
pointed at `env.APP_CONFIG_DIR/sessions` on real disk (so Pi's transcript
mirror lands outside the git-tracked working tree) — and runs a custom image
(`packages/apple-sandbox/image/Dockerfile`, built locally as
`officemachine/apple-sandbox:latest`) since the stock `ubuntu:24.04` base has
no `git`. `messageMetadataSchema` and the `HarnessMessage` (`UIMessage`) type
are exported from here and reused everywhere as `@workspace/agent/agent`'s
`HarnessMessage`.

This `agent` singleton — and the real sandbox it constructs at import time —
is only meant to be loaded server-side (`apps/api`). Anything that just needs
the message/tool *types* (e.g. `server/utils/schema.ts`,
`create-remote-agent.ts`) redeclares the shape instead of importing `agent`,
specifically to avoid constructing a live sandbox as a side effect of a type
import.

`lib/create-remote-agent.ts` + `lib/run-agent-tui.ts` build a remote,
HTTP-backed `UIMessageStreamAgent` (via `@workspace/agent-tui`, a vendored
`@ai-sdk/tui` fork) that drives a terminal UI by talking to `apps/api`'s
`/api/chat/:id` endpoints instead of running a harness in-process. See the
`apps/cli` note below — this runner currently has no live entry point.

### `apps/api` — the only place a harness actually runs

The core idea: **one durable Workflow per chat, parked on a hook between
turns** — not one workflow run per HTTP request.

- `POST /api/chat/:id` (`server/api/chat/[id]/index.ts`) checks storage for an
  already-alive workflow run for this `chatId`. If one exists, it resumes it
  by posting the new message into a `defineHook` (`harnessMessageHook`, token
  `chat:<chatId>`) and returns the stream's new tail. If the hook token is
  gone (run expired/finished) or none existed yet, it starts a fresh
  `harnessWorkflow` run and stores its `runId`.
- `harnessWorkflow` (`server/workflows/harness/workflow.ts`, `"use workflow"`)
  loops per chat: persist the incoming message → extract the prompt → drive
  `@ai-sdk/workflow-harness`'s slice loop (`createHarnessWorkflowState` /
  `runSlice`) to completion, carrying `resumeFrom` forward → `await hook` for
  the next message (or `{ end: true }`) → repeat. This is what makes a chat
  resumable across server restarts/redeploys with nothing but `chatId` on the
  client.
- `GET /api/chat/:id/stream` reconnects to the same run's live readable from
  a given `startIndex` (refresh/multi-tab support).
- `GET /api/chat/:id/messages` and `GET /api/chat` read persisted history
  straight from sqlite via Nitro's `useDatabase()` with raw `db.sql`
  tagged-template queries — **no drizzle or other ORM**, despite what may be
  assumed from other deps. Schema (`chats`, `messages` tables) is created ad
  hoc in `server/plugins/migrate-database.ts`.
- Boot-time plugins (`server/plugins/*`, Nitro `definePlugin`): `ensure-dirs.ts`
  (mkdir the `APP_CONFIG_DIR` subdirs), `migrate-database.ts` (above),
  `start-world.ts` — **required**: calls `(await getWorld()).start?.()`.
  Without it the Workflow queue/world never starts and every workflow route
  hangs forever.
- `server/workflows/dispatch/*` exists but nothing currently references it —
  don't assume it's live; `server/workflows/harness/*` is what's wired up.
- `GET/POST .../api/files/*` (`files.ts`) is mounted via `files-sdk`'s
  `createFilesRouter`, unauthenticated (no session/auth system exists yet —
  single-user local harness) and `downloadMode: "proxy"` (the fs adapter has
  no public base URL to redirect to).

### `apps/web` — Next.js chat UI

- Reaches `apps/api` through a same-origin rewrite (`next.config.ts`:
  `/api/:path*` → `env.APP_API_URL`) so the browser never makes a cross-origin
  call.
- `/chat` mints an id and redirects to `/chat/[id]`; that page server-fetches
  history from `/api/chat/:id/messages` and passes it to `<Chat>` as
  `initialMessages`.
- `components/chat.tsx`: `useChat<HarnessMessage>` + `DefaultChatTransport`.
  `prepareSendMessagesRequest` ships only the latest message to
  `/api/chat/:id` (the workflow owns history — see above);
  `prepareReconnectToStreamRequest` points at `/api/chat/:id/stream`.
  Rendering switches on `message.parts[].type` (`text`, `reasoning`,
  `tool-read/write/edit/bash/grep/glob/ls`, `dynamic-tool` for the
  `fileChange` provider-executed tool) — every builtin tool's output is typed
  `unknown` but is a plain string at runtime.

### `apps/cli` — mid-rewrite; don't assume it's wired up

Currently the stock `create-ink-app` scaffold (Ink v4, `xo` + `ava` + `meow`,
unmodified "Hello, Stranger" demo) with a `@workspace/tui` dependency it
doesn't yet import. It does **not** currently use `@workspace/agent-tui` or
`packages/agent/lib/run-agent-tui.ts` — the remote-agent TUI runner described
above exists but has no live entry point right now. `packages/tui` is a new,
separate, from-scratch terminal design-system package (Ink components:
`spinner`, `theme-provider`, a `use-animation` hook, `terminal-themes`; ships
a `components.json` in the TermCN/shadcn-for-terminal style) evidently meant
to back the next iteration of `apps/cli`. Verify current file contents before
building on either — this area is actively being reshaped.

### `apps/terminal` — wterm desktop shell

A zero-native (Zig) WebView shell hosting a Next.js static export that runs
the `wterm` terminal emulator with `@wterm/just-bash` — an in-browser bash
shell with **no native PTY, no JS bridge, no backend**; everything runs
client-side via WASM. See `AGENTS.md` for the detailed build gotchas (pinned
`just-bash@^2.14.2`, required `transpilePackages`, the `wterm.wasm` copy step,
etc.) and `apps/terminal/README.md` for Zig build flags.

### `packages/*` at a glance

| Package | Role |
| --- | --- |
| `agent` | Harness core — the `agent` singleton and the remote-TUI runner (above) |
| `agent-tui` | Vendored `@ai-sdk/tui` fork adding the `UIMessageStreamAgent` shape + `runAgentTUI` |
| `config` | `.env` (`zod-config` + `dotenvx`) and JSON5 `settings.json5`; explicit subpath exports only (`./env`, `./settings`) — a bare `@workspace/config` import fails |
| `apple-sandbox` | Apple `container` CLI sandbox provider (renamed from `sandbox-container`) — backs `packages/agent`'s local dev sandbox via `omni-sandbox` |
| `omni-sandbox` | `createOmniSandbox` — switches between `apple-sandbox` (local) and `@ai-sdk/sandbox-vercel` (deployed), auto-detected via `process.env.VERCEL` |
| `tui` | New Ink/TermCN terminal component library (see `apps/cli` note) |
| `ui` | Shared React 19 + shadcn design system for `apps/web`/`apps/site-legacy`, source in `src/` (not `lib/`) |
| `zero-web` | A Zero-lang (`zerolang`) web framework experiment — unrelated to the AI SDK harness stack |

### Nested git repo: `apps/site-legacy`

`apps/site-legacy` (renamed from `apps/site`) contains its own `.git`
directory (its own history, likely from an external template's `git init`)
and is **not** a registered submodule (no `.gitmodules`). The parent repo's
`git status` shows it as a plain untracked directory; running `git add
apps/site-legacy` from the root would create a broken gitlink rather than
tracking its files. Treat it as its own repo for now.

### Other conventions

- Two source-layout conventions coexist: `agent`, `agent-tui`, `config`,
  `apple-sandbox`, `omni-sandbox` put source in `lib/`; `ui` and
  `tui` put it in `src/`. Each package's `exports` map reflects this — check
  it before assuming an import path.
- `@workspace/config`'s env load is a hard runtime dependency of
  `@workspace/agent` and of the Nitro boot plugins; if it fails, nothing
  boots.
- Harness packages (`@ai-sdk/harness*`, `@ai-sdk/sandbox-*`,
  `@ai-sdk/workflow-harness`) are experimental; verify against current docs
  before upgrading.

## Coding rules

`AGENTS.md` at the repo root holds the durable engineering rules for this
codebase — general conventions plus a running log of hard rules distilled
from user corrections. It updates over time as corrections happen, so it's
imported live here rather than copied:

@AGENTS.md
