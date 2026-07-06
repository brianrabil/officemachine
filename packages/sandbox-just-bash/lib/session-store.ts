/**
 * `cwd` + `env` (which also carries aliases, stored as `BASH_ALIAS_<name>`
 * entries — see `alias`/`unalias` in just-bash's interpreter).
 *
 * `just-bash`'s `Bash.exec()` is deliberately stateless per call — every
 * invocation runs against an isolated copy of interpreter state and discards
 * it afterward ("Each exec call gets an isolated state copy - like starting a
 * new shell", `Bash.ts`). `Bash.getCwd()`/`getEnv()` only ever reflect the
 * value passed to the constructor; they never change no matter what commands
 * run. So `JustBashSandboxSession` tracks `cwd`/`env` itself (see
 * {@link JustBashSessionState}), threading the previous call's resulting
 * `env` (which includes the new `cwd` via `PWD`) into the next `exec()`
 * call's options — turning a sequence of otherwise-independent `run()` calls
 * into something that behaves like a persistent shell.
 *
 * This is also the only state that can survive a `resumeSession()` — a
 * resumed sandbox is always a freshly-constructed `Sandbox` (just-bash has no
 * snapshot API), seeded with this snapshot's `cwd`/`env` as its initial
 * values. Shell functions, `shopt`/`set` options, the directory stack, and
 * background processes are NOT captured — just-bash exposes no public API
 * for them, and (for background processes) there is nothing to resume across
 * a process boundary in the first place.
 */
export interface JustBashSessionSnapshot {
  cwd: string;
  env: Record<string, string>;
}

/**
 * The mutable, in-flight counterpart of {@link JustBashSessionSnapshot} —
 * updated after every `run()` call for as long as a session is alive, then
 * persisted verbatim via `JustBashSessionStore.set()` on `stop()`.
 */
export type JustBashSessionState = JustBashSessionSnapshot;

export interface JustBashSessionStore {
  get(sessionId: string): Promise<JustBashSessionSnapshot | undefined>;
  set(sessionId: string, snapshot: JustBashSessionSnapshot): Promise<void>;
}

/**
 * Default store when none is injected. Durable only within the current
 * process — fine for same-process mid-turn continuation, not for resuming
 * after a process restart. Pass a real `JustBashSessionStore` (e.g. backed by
 * `nitro/storage`) for cross-restart durability.
 */
export function createInMemorySessionStore(): JustBashSessionStore {
  const snapshots = new Map<string, JustBashSessionSnapshot>();
  return {
    async get(sessionId) {
      return snapshots.get(sessionId);
    },
    async set(sessionId, snapshot) {
      snapshots.set(sessionId, snapshot);
    },
  };
}
