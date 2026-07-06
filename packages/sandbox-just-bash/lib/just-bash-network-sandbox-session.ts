import {
  HarnessCapabilityUnsupportedError,
  type HarnessV1NetworkSandboxSession,
} from "@ai-sdk/harness";
import type { Experimental_SandboxSession as SandboxSession } from "@ai-sdk/provider-utils";
import { randomUUID } from "node:crypto";
import type { Sandbox } from "just-bash";
import { JustBashSandboxSession } from "./just-bash-sandbox-session";
import type { JustBashSessionState, JustBashSessionStore } from "./session-store";

const JUST_BASH_PROVIDER_ID = "just-bash-sandbox";

/**
 * `HarnessV1NetworkSandboxSession` backed by a `just-bash` `Sandbox`. It extends
 * {@link JustBashSandboxSession} with the infra surface. Exposes no ports —
 * there is no network namespace and no way to publish an HTTP endpoint
 * reachable from outside the host process. Bridge-backed harness adapters that
 * need `getPortUrl` will fail with `HarnessCapabilityUnsupportedError` at start.
 *
 * Network policy is not implementable locally either — `setNetworkPolicy` is
 * omitted.
 *
 * On `stop()`, persists the session's live `state` (see
 * {@link JustBashSessionState} for why that's tracked here rather than read
 * off the sandbox) into `sessionStore` keyed by `id`, so a later
 * `resumeSession` for the same `sessionId` can restore it into a
 * freshly-constructed `Sandbox` — even `shopt`/`set` options and the
 * directory stack do not survive that reconstruction, since `just-bash`
 * exposes no API to capture them.
 *
 * Shell functions are a step further out of reach than that: they don't even
 * survive between two calls on the exact same live `Sandbox`, reconstructed
 * or not (`Bash.exec()`'s `BashExecResult` has no `functions` field to read
 * them back out of, the way it has `env`) — so unlike `cwd`/`env`, there is
 * nothing here or in `JustBashSandboxProvider`'s live-session cache that
 * could thread them forward. What the live-session cache genuinely rescues:
 * background processes still running when a resume happens (impossible to
 * resume after reconstruction — there is no process to reattach to) and
 * anything written to a non-disk-backed filesystem layer (e.g. `InMemoryFs`
 * outside a mounted `ReadWriteFs`), since it's the literal same in-memory
 * object graph. See `JustBashSandboxProvider`'s class doc comment.
 *
 * `destroy()` calls `onEvict` (supplied by the provider) so the provider's
 * live-session cache doesn't hold a reference to a session nobody will ever
 * resume again. `stop()` does not — the whole point of the cache is to
 * survive a stop-then-resume within the same process.
 */
export class JustBashNetworkSandboxSession
  extends JustBashSandboxSession
  implements HarnessV1NetworkSandboxSession
{
  /**
   * The caller-provided `sessionId` when available (so `resumeSession` can
   * look up this session's snapshot later); otherwise a random id minted at
   * construct time purely to satisfy the `HarnessV1NetworkSandboxSession.id`
   * contract.
   */
  readonly id: string;
  readonly defaultWorkingDirectory: string;
  private readonly ownsLifecycle: boolean;
  private readonly sessionStore: JustBashSessionStore;
  private readonly onEvict: () => void;

  constructor(input: {
    sandbox: Sandbox;
    ownsLifecycle: boolean;
    sessionId?: string;
    sessionStore: JustBashSessionStore;
    initialState: JustBashSessionState;
    onEvict?: () => void;
  }) {
    super(input.sandbox, input.initialState);
    this.ownsLifecycle = input.ownsLifecycle;
    this.sessionStore = input.sessionStore;
    this.id = input.sessionId ?? randomUUID();
    this.defaultWorkingDirectory = input.initialState.cwd;
    this.onEvict = input.onEvict ?? (() => {});
  }

  readonly ports: ReadonlyArray<number> = [];

  /** Shares `state` by reference so commands run through either view thread
   * cwd/env to each other. */
  restricted(): SandboxSession {
    return new JustBashSandboxSession(this.sandbox, this.state);
  }

  getPortUrl = async (_options: {
    port: number;
    protocol?: "http" | "https" | "ws";
  }): Promise<string> => {
    throw new HarnessCapabilityUnsupportedError({
      harnessId: JUST_BASH_PROVIDER_ID,
      message:
        "just-bash sandboxes run in-process and cannot expose a port URL. " +
        "Use a hosted sandbox (e.g. @ai-sdk/sandbox-vercel) for bridge-backed harness adapters.",
    });
  };

  stop = async (): Promise<void> => {
    if (!this.ownsLifecycle) return;
    // this.state, not sandbox.bashEnvInstance.getCwd()/getEnv() — those never
    // change after construction (see JustBashSessionSnapshot's doc comment).
    await this.sessionStore.set(this.id, { cwd: this.state.cwd, env: this.state.env });
    // just-bash has no explicit shutdown; the sandbox is garbage-collected
    // along with its in-memory filesystem once references drop.
  };

  destroy = async (): Promise<void> => {
    await this.stop();
    this.onEvict();
  };
}
