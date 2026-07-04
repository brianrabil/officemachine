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
- No TypeScript casts in application code. Do not write `as string`,
  `response.json() as ...`, `window as ...`, or other assertions to force a
  type. Fix the source contract, use typed APIs, or parse unknown data at the
  boundary with Zod.
- No hacks or tech debt. If the correct implementation cannot be done, say so
  instead of adding a quick fix.
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
- Keep Turborepo task logic package-local. Root build/check/dev/test scripts
  should delegate through `turbo run`; interactive TTY entrypoints may call the
  package directly when Turbo drops stdin.
