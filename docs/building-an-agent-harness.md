# Building an Agent Harness

Engineering guide for this repo. It explains what an agent harness is, the layered
architecture, and how to build one — grounded in the concrete files in
`agent-harness`. The stack is the Vercel **AI SDK harness** ecosystem
(`@ai-sdk/harness` + a runtime adapter + a sandbox provider) on AI SDK 7.

> Harness packages are **experimental**; expect breaking changes between releases.
> Verify APIs against the docs before upgrading. Links at the bottom.

---

## 1. What a harness is (and isn't)

A **harness** is a complete agent *runtime* — Claude Code, Codex, or Pi — that owns
capabilities larger than a single model call: workspace access, built-in coding
tools, native session state, compaction, and permission flows. You do **not**
rebuild the tool loop; the runtime drives the task and the AI SDK projects its
output into familiar stream/response types.

This is the opposite of a plain `generateText`/`streamText` tool loop, where *you*
own the loop, the tools, and the full message history. Reach for a harness when you
want an existing runtime to inspect and modify a sandboxed workspace across
multi-turn sessions; reach for models when you want direct control of the call.

The abstraction has **four pieces**, and it's worth holding them distinct:

| Piece | Role | In this repo |
|---|---|---|
| `HarnessAgent` | The AI SDK agent you use in app code. Holds config, not live state. | `packages/agent/lib/agent.ts` |
| Harness adapter | Connects to a runtime (Pi / Codex / Claude Code). | `@ai-sdk/harness-pi` via `createPi(...)` |
| Sandbox provider | Isolated filesystem + process where the runtime executes. | `createDurableJustBashSandbox` |
| Session | Live conversation + workspace state for one run. | `HarnessAgentSession` (session-store.ts) |

Adapter ↔ sandbox is a compatibility decision, not a free choice. **Bridge-backed**
runtimes (Claude Code, Codex) need a real network sandbox like
`@ai-sdk/sandbox-vercel` because they expose a port. **Host-runtime** runtimes (Pi)
can also run on the in-process `@ai-sdk/sandbox-just-bash`. This repo uses Pi +
just-bash, which is why a durable local sandbox is even possible.

---

## 2. Repo topology

A Turborepo monorepo (`bun`, `turbo`) with one reusable core and three frontends:

```
packages/agent   ← the harness core (everything below builds on this)
  lib/agent.ts            HarnessAgent instance (adapter + sandbox wired together)
  lib/registry.ts         provider/model registry
  lib/config.ts           env parsed once at the boundary (zod-config)
  lib/paths.ts            single source of truth for on-disk locations
  lib/durable-just-bash.ts durable, resumable sandbox wrapper  ← the crux
  lib/session-store.ts    persist/resume the opaque resume-state token
  lib/chat-id.ts          mint chat ids

apps/api    Nitro server: POST /api/chat (stream + resume), /api/start-workflow (durable)
apps/tui    terminal UI via @ai-sdk/tui runAgentTUI
apps/web    Next.js chat via useChat + DefaultChatTransport
packages/db Drizzle + libsql
packages/ui shadcn component library
```

The payoff of putting the harness in `packages/agent`: **the API server, the TUI,
and the web app all import the same `agent`.** Build the core once; render it three
ways.

---

## 3. The core: constructing the agent

`packages/agent/lib/agent.ts` — construct at **module scope**. The agent holds
configuration; live state belongs to the session.

```ts
export const agent = new HarnessAgent({
  id: "agent-1",
  harness: createPi({
    model: `${model.provider}/${model.id}`,
    auth: { customEnv: { OPENCODE_API_KEY: config.OPENCODE_API_KEY, /* ... */ } },
  }),
  sandbox: createDurableJustBashSandbox({ root: workspaceRoot }),
  sandboxConfig: { workDir: "./" },
});
```

Settings worth knowing (`HarnessAgent`): `harness`, `sandbox`, `id`, `instructions`
(applied once to a fresh session), `tools` (AI SDK tools the host executes when the
harness calls them), `skills`, `permissionMode`, `toolApproval`, `sandboxConfig`,
and `telemetry`/`debug`/`onLog`. **Adapter-specific** options go on the adapter
factory, e.g. `createCodex({ reasoningEffort: "high" })` — not on `HarnessAgent`.

Config and model selection are kept at boundaries:

- `config.ts` parses env **once** with `zod-config` and a Zod schema. Everything
  downstream trusts the parsed object — no scattered re-validation.
- `registry.ts` builds a `createProviderRegistry` (gateway + ollama) and picks the
  built-in model. Swapping models is a one-line change here.

---

## 4. Sessions and the memory model (the big idea)

**A harness session owns its native conversation history.** When you pass messages,
`HarnessAgent` takes the *latest user message* as the fresh input for the turn — it
does **not** replay the full prior conversation. This inverts the usual chatbot
pattern and shows up in two places in this repo:

Server (`apps/api/server/api/chat.post.ts`):

```ts
const messages = await convertToModelMessages([body.message]); // just the latest
const session = await resumeOrCreateSession({ agent, chatId });
const result = await agent.stream({ session, messages });
```

Client (`apps/web/components/chat.tsx`) — the transport only ships the last message:

```ts
prepareSendMessagesRequest({ messages, id }) {
  return { body: { message: messages[messages.length - 1], id } };
}
```

Because history lives in the session, **you persist and resume the session, not the
transcript.** Get this wrong and you either double-feed history or lose it.

### Session lifecycle

Create before running; end explicitly:

- `session.destroy()` — stops the runtime, discards resumability. Use for one-off
  scripts and tests (see `apps/tui/src/main.ts`'s `finally`).
- `session.detach()` — parks runtime + sandbox, returns resume state, keeps the
  sandbox warm. Use for HTTP routes needing multi-turn continuity.
- `session.stop()` — saves resume state, then stops runtime + sandbox.
- `session.suspendTurn()` — advanced: hand off an *active* turn across a process
  boundary; resume with `continueFrom` + `continueStream()`/`continueGenerate()`.

---

## 5. Persistence: two layers, one token

Cross-turn continuity is split deliberately (`session-store.ts`):

1. **Heavy state** — transcript and files — lives *with the sandbox provider* on
   disk. That's the durable substrate.
2. **A tiny opaque resume-state token** from `session.detach()` is bookkept
   separately, keyed by `chatId`, and passed back as `resumeFrom` next turn.

```ts
// resume
const resumeFrom = await loadResumeState(chatId);
return agent.createSession(resumeFrom
  ? { sessionId: chatId, resumeFrom }
  : { sessionId: chatId });

// after the stream finishes
const resumeState = await session.detach();
await writeFile(resumeStateFile(chatId), JSON.stringify(resumeState));
```

Within one process, `createSession({ resumeFrom })` hits the harness's in-memory
parked-session fast path; across a restart it rehydrates from the on-disk session
file. The token is stored on disk (not just a memory map) so it survives a restart —
swap in a DB/KV without changing the pattern. `HarnessAgent` validates that the
resume state came from the *same adapter* before using it.

The route wires persistence into the stream's completion:

```ts
return createUIMessageStreamResponse({
  stream: toUIMessageStream({
    stream: result.stream,
    onFinish: () => detachAndPersist({ chatId, session }),
  }),
});
```

---

## 6. Making the sandbox durable (the crux)

`durable-just-bash.ts` is the most instructive file in the repo. `just-bash` is
normally in-process and in-memory: fast and contained, but its filesystem and
session state evaporate when the process ends, and it deliberately omits
`resumeSession`. The wrapper turns it into a durable substrate the harness's
cross-process resume actually works against — three changes, all quarantined here:

1. **Back the FS with real disk** — `ReadWriteFs({ root })` instead of memory, so
   the agent's files *and* Pi's mirrored transcript survive a restart.
2. **Add `resumeSession`** delegating to `createSession`. Safe *because* state now
   lives on `root`: a fresh sandbox over the same root **is** the resumed sandbox.
   Without it, `createSession({ resumeFrom })` throws
   `AI_HarnessCapabilityUnsupportedError`.
3. **Pre-create `<root>/.pi-sessions`.** On detach, harness-pi mirrors the
   transcript via `mkdir -p` then `writeBinaryFile` — but the mkdir races the
   detach teardown and the write ENOENTs *silently* (swallowed try/catch), so
   nothing persists and resume finds an empty conversation. Giving the write a
   parent that already exists sidesteps the race. **This is the fix that makes
   resume real.**

```ts
export function createDurableJustBashSandbox({ root }): HarnessV1SandboxProvider {
  mkdirSync(path.join(root, ".pi-sessions"), { recursive: true });
  const base = createJustBashSandbox({
    fs: new ReadWriteFs({ root }), cwd: "/", defenseInDepth: false,
  });
  return { ...base, resumeSession: (options) => base.createSession(options) };
}
```

The lesson generalizes: **the sandbox provider is where durability lives.** If you
target Vercel Sandbox instead, you get durability and a network bridge from the
provider and skip this wrapper entirely — but you inherit its own lifecycle.

### `sandboxConfig` hooks

Prepare the sandbox without patching the provider:

- `onBootstrap` runs during template creation (before a snapshot is published) —
  expensive, reusable setup like installing `ripgrep`. Pair it with `bootstrapHash`
  and bump the hash to invalidate the snapshot.
- `onSession` runs after each session is acquired (including resumes) — per-session
  files and lightweight config.

For hot starts, `prepareHarnessSandboxTemplate()` / `prepareSandboxForHarness()`
build or snapshot a reusable template ahead of time.

---

## 7. Paths discipline

`paths.ts` is the single source of truth for on-disk locations — pure definitions,
no side effects (each owner `mkdir`s its own dir). Two rules baked in:

- Base dir precedence: `HARNESS_DATA_DIR` (pin it to a mounted volume in a
  container) → otherwise `process.cwd()`.
- **Do not derive from `import.meta.url`.** Nitro bundles these modules, so
  `import.meta.url` resolves into the ephemeral `.nitro` build dir that's wiped on
  rebuild. `workspaceRoot` = `<dataDir>/.harness-workspace`; `resumeStateDir` =
  `<dataDir>/.resume-state`.

---

## 8. Durable long-running turns (workflows)

A single HTTP handler is fine for interactive chat, but long autonomous runs need to
survive crashes and redeploys. `apps/api/workflows/harness-workflow` uses
`@ai-sdk/workflow-harness` with the Vercel Workflow runtime (`"use workflow"` /
`"use step"` directives) to make a turn a **resumable, crash-safe** sequence of
slices:

```ts
export async function codingWorkflow(input) {
  "use workflow";
  const resumeFrom = await loadResumeStep(input.sessionId);
  let state = createHarnessWorkflowState({ ...input, resumeFrom });
  while (state.status === "running" || state.status === "timed_out") {
    state = await runSlice(state);      // each slice is a durable "use step"
  }
  await persistResumeStep({ sessionId: state.sessionId, resumeState: state.resumeFrom });
  return finalizeHarnessWorkflow(state);
}
```

`runHarnessAgentSlice` advances the agent one durable slice at a time; the loop
re-enters on `timed_out` so a turn longer than one execution window keeps going. The
API exposes it via `POST /api/start-workflow`, streaming `run.readable` back as a
UI-message stream. Note the same **resume-state token** pattern reappears here — the
persistence idea is identical, only the substrate (Workflow steps) differs.

---

## 9. Frontends over the same core

**Terminal (`apps/tui`)** — wrap the shared `agent` in the `AgentTUIAgent` shape and
hand it to `runAgentTUI`. One session per process, `destroy()` in `finally`:

```ts
const session = await agent.createSession();
try {
  await runAgentTUI({ title: "Pi", agent: createTUIAgent({ agent, session }),
    tools: "auto-collapsed", reasoning: "auto-collapsed" });
} finally { await session.destroy(); }
```

**Web (`apps/web`)** — `useChat` + `DefaultChatTransport` pointed at `/api/chat`,
with the last-message-only `prepareSendMessagesRequest`. Rendering walks
`message.parts` and switches on part type (`text`, `reasoning`,
`tool-*`/`dynamic-tool`) — the harness stream is projected into standard AI SDK UI
parts, so nothing bespoke is needed. Visiting `/chat` mints a `newChatId()` and
redirects to the permalink; the session/transcript is created lazily on first
message.

**Streaming interop chain:** harness `result.stream` → `toUIMessageStream` →
`createUIMessageStreamResponse` → `useChat` renders `UIMessage.parts`. Events without
a first-class AI SDK part (workspace file changes, compaction) arrive as dynamic
provider-executed tool parts.

---

## 10. Build one from scratch — checklist

1. **Scaffold** a Turborepo monorepo; put the harness in `packages/agent` so every
   frontend shares it.
2. **Install** the three pieces: `@ai-sdk/harness` + an adapter
   (`@ai-sdk/harness-pi` | `-codex` | `-claude-code`) + a sandbox
   (`@ai-sdk/sandbox-just-bash` for host-runtime local, `@ai-sdk/sandbox-vercel` for
   bridge-backed/remote).
3. **Config boundary:** parse env once with `zod-config`; centralize on-disk paths
   in one side-effect-free module; keep base-dir precedence explicit.
4. **Construct `HarnessAgent`** at module scope: adapter + sandbox + `instructions`,
   any host `tools`/`skills`, and `sandboxConfig`.
5. **Durability:** if using an in-memory sandbox, wrap it — real-disk FS, add
   `resumeSession`, and pre-create the adapter's transcript dir to dodge the
   detach race. If using Vercel Sandbox, rely on the provider instead.
6. **Session store:** `resumeOrCreateSession` keyed by `chatId`;
   `detachAndPersist` on stream finish; store the opaque token (disk now, DB later).
7. **HTTP route:** latest message only → `agent.stream({ session, messages })` →
   `toUIMessageStream({ onFinish: detachAndPersist })` →
   `createUIMessageStreamResponse`.
8. **Frontends:** `useChat` for web (last-message transport), `runAgentTUI` for the
   terminal.
9. **Long runs:** move the turn into `@ai-sdk/workflow-harness` slices for
   crash-safe, resumable execution.
10. **Verify:** send a message, restart the process, send another in the same
    `chatId`, and confirm the agent remembers — that exercises the entire durability
    chain end to end.

---

## 11. Design constraints (from `AGENTS.md`)

These are the repo's hard rules and they shape the harness design directly:

- Build **directly on documented primitives** — `HarnessAgent`, AI SDK UI
  message/chat APIs, `bash-tool`. No compatibility layers, copied tool loops, custom
  runtime event unions, or parallel conversation state.
- Consume chat via `UIMessage.parts` and documented helpers (`useChat`,
  `DirectChatTransport`, `addToolApprovalResponse`, `sendAutomaticallyWhen`).
- Skills go through `experimental_createSkillTool`; pass its `files`/`instructions`
  into `createBashTool`. Context compaction goes through AI SDK agent step
  preparation — not a separate custom helper.
- Parse unknown input **once at boundaries** with Zod; no scattered re-validation,
  no defensive try/catch, no silent error swallowing — fail fast and fix the source
  contract. No TypeScript casts in app code.
- Keep Turborepo task logic package-local; root scripts delegate through
  `turbo run`.

The throughline: **let the harness runtime and the AI SDK own the hard parts**
(loop, memory, compaction, streaming) and keep your code to wiring, durability, and
boundaries.

---

## Sources

- [AI SDK Harnesses — Overview](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)
- [AI SDK Harnesses — HarnessAgent](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent)
- [AI SDK Harnesses — Harness Adapters](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-adapters)
- [AI SDK Harnesses — Skills](https://ai-sdk.dev/docs/ai-sdk-harnesses/skills)
- [AI SDK Harnesses — Workflow Utilities](https://ai-sdk.dev/docs/ai-sdk-harnesses/workflow-utilities)
- [AI SDK Harnesses — UI](https://ai-sdk.dev/docs/ai-sdk-harnesses/ui) · [Terminal UI](https://ai-sdk.dev/docs/ai-sdk-harnesses/terminal-ui)
- [Vercel changelog — Program agent harnesses with AI SDK](https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk)
- Repo files: `packages/agent/lib/*`, `apps/api/server/api/chat.post.ts`, `apps/api/workflows/harness-workflow/*`, `apps/tui/src/main.ts`, `apps/web/components/chat.tsx`, `AGENTS.md`
