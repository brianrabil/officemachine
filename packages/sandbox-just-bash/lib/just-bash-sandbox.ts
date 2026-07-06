import type { HarnessV1NetworkSandboxSession, HarnessV1SandboxProvider } from "@ai-sdk/harness";
import type { Experimental_SandboxSession as SandboxSession } from "@ai-sdk/provider-utils";
import { Sandbox } from "just-bash";
import { JustBashNetworkSandboxSession } from "./just-bash-network-sandbox-session";
import {
  createInMemorySessionStore,
  type JustBashSessionState,
  type JustBashSessionStore,
} from "./session-store";

/**
 * `getCwd()`/`getEnv()` only reflect the constructor's initial values (see
 * `JustBashSessionSnapshot`'s doc comment) — which is exactly what we want
 * here, immediately after `Sandbox.create()`, before any `run()` call has had
 * a chance to make them stale.
 */
function initialStateFor(sandbox: Sandbox): JustBashSessionState {
  return { cwd: sandbox.bashEnvInstance.getCwd(), env: sandbox.bashEnvInstance.getEnv() };
}

/**
 * Parameters forwarded to `just-bash`'s `Sandbox.create` when creating a
 * sandbox from scratch. Aliased directly from the underlying SDK so the full
 * surface is available without us re-declaring it.
 */
type JustBashSandboxCreateParams = NonNullable<Parameters<typeof Sandbox.create>[0]>;

/**
 * Settings for {@link createJustBashSandbox}. Two mutually-exclusive shapes:
 *
 * - `{ sandbox }` — wrap an already-created `just-bash` `Sandbox`. The caller
 *   owns its lifecycle; `resumeSession` just re-wraps the same instance since
 *   there is nothing else to reconstruct it from.
 * - {@link JustBashSandboxCreateParams} fields — provider calls
 *   `Sandbox.create(settings)` on every `createSession()`, and (with a
 *   restored `cwd`/`env`) on `resumeSession()` too.
 *
 * `sessionStore` is optional and defaults to an in-process `Map` (see
 * {@link createInMemorySessionStore}) — durable only within the current
 * process. Pass a real store (e.g. backed by `nitro/storage`) for
 * resumption across process restarts.
 *
 * `liveSessionTtlMs` bounds how long an idle in-memory session (see
 * {@link JustBashSandboxProvider}'s class doc comment) is kept before it's
 * evicted and a `resumeSession` call has to fall back to reconstruction.
 * Defaults to 30 minutes.
 */
export type JustBashSandboxSettings =
  | { sandbox: Sandbox; sessionStore?: JustBashSessionStore; liveSessionTtlMs?: number }
  | (JustBashSandboxCreateParams & {
      sandbox?: never;
      sessionStore?: JustBashSessionStore;
      liveSessionTtlMs?: number;
    });

const JUST_BASH_PROVIDER_ID = "just-bash-sandbox";
const DEFAULT_LIVE_SESSION_TTL_MS = 30 * 60 * 1000;

interface LiveSessionEntry {
  session: JustBashNetworkSandboxSession;
  lastAccessedAt: number;
}

export function createJustBashSandbox(
  settings: JustBashSandboxSettings = {} as JustBashSandboxSettings,
): HarnessV1SandboxProvider {
  return new JustBashSandboxProvider(settings);
}

/**
 * `HarnessV1SandboxProvider` implementation backed by `just-bash`. Useful for
 * non-bridge harness flows and for handing a local `Experimental_SandboxSession`
 * to AI SDK tools — use `provider.createSession()` then
 * `sandboxSession.restricted()` to get the latter.
 *
 * Unlike `@ai-sdk/sandbox-just-bash`, sessions here behave like a persistent
 * shell: `just-bash`'s own `Bash.exec()` is stateless per call by design (see
 * `JustBashSessionSnapshot`'s doc comment), so `JustBashSandboxSession` tracks
 * `cwd`/`env` itself and threads it from one `run()` call into the next. That
 * same tracked state is also what makes `resumeSession` real: `just-bash` has
 * no snapshot API, so a "resume" always constructs a brand-new in-process
 * `Sandbox`, but it's seeded with the `cwd`/`env` (which also carries aliases,
 * stored as `BASH_ALIAS_<name>` entries) captured on the previous session's
 * `stop()` — both are first-class `Sandbox.create()` options. Shell
 * functions, `shopt`/`set` options, the directory stack, and background
 * processes do NOT survive a resume — `Bash` exposes no public API for them.
 *
 * Note: just-bash cannot expose ports, so bridge-backed harness adapters
 * (claude-code, codex) will reject this provider at start.
 *
 * Every session created or resumed with an explicit `sessionId` is kept
 * alive in an in-memory `liveSessions` map. `run-harness-agent-slice`'s slice
 * loop (`@ai-sdk/workflow-harness`) never calls `stop()`/`destroy()` before a
 * same-process resume — it uses `detach()`/`suspendTurn()`, which don't touch
 * the sandbox at all — so without this cache the JS object would just be
 * garbage-collected once its slice's stack frame returns, and the next
 * `resumeSession` would always pay the reconstruction cost. `resumeSession`
 * checks this cache before falling back to reconstructing from
 * `sessionStore`, so a same-process resume gets the exact same live object
 * back — background processes still running keep running, and anything
 * written to a non-disk-backed filesystem layer is still there (neither
 * survives reconstruction). It does NOT rescue shell functions or `shopt`/
 * `set` options either way — see `JustBashNetworkSandboxSession`'s doc
 * comment for why those are out of reach regardless of caching. Entries are
 * evicted on `destroy()` (a real "never resuming this" signal from the slice
 * loop) and lazily swept after `liveSessionTtlMs` of inactivity otherwise, so
 * an abandoned session doesn't pin memory forever.
 */
export class JustBashSandboxProvider implements HarnessV1SandboxProvider {
  readonly specificationVersion = "harness-sandbox-v1" as const;
  readonly providerId = JUST_BASH_PROVIDER_ID;
  private readonly sessionStore: JustBashSessionStore;
  private readonly liveSessionTtlMs: number;
  private readonly liveSessions = new Map<string, LiveSessionEntry>();

  constructor(private readonly settings: JustBashSandboxSettings) {
    this.sessionStore = settings.sessionStore ?? createInMemorySessionStore();
    this.liveSessionTtlMs = settings.liveSessionTtlMs ?? DEFAULT_LIVE_SESSION_TTL_MS;
  }

  private sweepExpiredLiveSessions(): void {
    const now = Date.now();
    for (const [sessionId, entry] of this.liveSessions) {
      if (now - entry.lastAccessedAt > this.liveSessionTtlMs) {
        this.liveSessions.delete(sessionId);
      }
    }
  }

  createSession = async (options?: {
    sessionId?: string;
    abortSignal?: AbortSignal;
    identity?: string;
    onFirstCreate?: (
      session: SandboxSession,
      opts: { abortSignal?: AbortSignal },
    ) => Promise<void>;
  }): Promise<HarnessV1NetworkSandboxSession> => {
    options?.abortSignal?.throwIfAborted();
    this.sweepExpiredLiveSessions();

    if ("sandbox" in this.settings && this.settings.sandbox) {
      return new JustBashNetworkSandboxSession({
        sandbox: this.settings.sandbox,
        ownsLifecycle: false,
        sessionId: options?.sessionId,
        sessionStore: this.sessionStore,
        initialState: initialStateFor(this.settings.sandbox),
      });
    }

    const createParams = this.settings as JustBashSandboxCreateParams;
    const sessionId = options?.sessionId;

    const sandbox = await Sandbox.create(createParams);
    const sandboxSession = new JustBashNetworkSandboxSession({
      sandbox,
      ownsLifecycle: true,
      sessionId,
      sessionStore: this.sessionStore,
      initialState: initialStateFor(sandbox),
      onEvict: sessionId ? () => this.liveSessions.delete(sessionId) : undefined,
    });

    if (sessionId) {
      this.liveSessions.set(sessionId, { session: sandboxSession, lastAccessedAt: Date.now() });
    }

    if (options?.onFirstCreate != null) {
      await options.onFirstCreate(sandboxSession.restricted(), {
        abortSignal: options?.abortSignal,
      });
    }

    return sandboxSession;
  };

  resumeSession = async (options: {
    sessionId: string;
    abortSignal?: AbortSignal;
  }): Promise<HarnessV1NetworkSandboxSession> => {
    options.abortSignal?.throwIfAborted();
    this.sweepExpiredLiveSessions();

    const live = this.liveSessions.get(options.sessionId);
    if (live) {
      live.lastAccessedAt = Date.now();
      return live.session;
    }

    if ("sandbox" in this.settings && this.settings.sandbox) {
      return new JustBashNetworkSandboxSession({
        sandbox: this.settings.sandbox,
        ownsLifecycle: false,
        sessionId: options.sessionId,
        sessionStore: this.sessionStore,
        initialState: initialStateFor(this.settings.sandbox),
      });
    }

    const createParams = this.settings as JustBashSandboxCreateParams;
    const snapshot = await this.sessionStore.get(options.sessionId);

    const sandbox = await Sandbox.create({
      ...createParams,
      cwd: snapshot?.cwd ?? createParams.cwd,
      env: { ...createParams.env, ...snapshot?.env },
    });

    const sessionId = options.sessionId;
    const sandboxSession = new JustBashNetworkSandboxSession({
      sandbox,
      ownsLifecycle: true,
      sessionId,
      sessionStore: this.sessionStore,
      // Sandbox.create() above already applied the restored cwd/env, so
      // reading it back here (rather than reusing `snapshot` directly) also
      // correctly falls back to createParams' defaults when there was no
      // prior snapshot for this sessionId yet.
      initialState: initialStateFor(sandbox),
      onEvict: () => this.liveSessions.delete(sessionId),
    });
    this.liveSessions.set(sessionId, { session: sandboxSession, lastAccessedAt: Date.now() });

    return sandboxSession;
  };
}
