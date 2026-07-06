import { randomUUID } from "node:crypto";
import type { HarnessV1NetworkSandboxSession, HarnessV1SandboxProvider } from "@ai-sdk/harness";
import type { Experimental_SandboxSession as SandboxSession } from "@ai-sdk/provider-utils";
import {
  buildExecArgs,
  buildRunArgs,
  type ContainerCliOptions,
  type ContainerMount,
  runContainerCli,
  runContainerCliChecked,
  toContainerName,
  type ResolvedPortMapping,
} from "./container-cli";
import { ContainerNetworkSandboxSession } from "./container-network-sandbox-session";

export type { ContainerMount };

export interface ContainerPortMapping {
  readonly containerPort: number;
  /** Defaults to `containerPort` when omitted. */
  readonly hostPort?: number;
  readonly protocol?: "tcp" | "udp";
}

/**
 * Parameters forwarded to `container run` when creating a sandbox from
 * scratch. Unlike `@ai-sdk/sandbox-vercel`/`@workspace/sandbox-just-bash`,
 * there is no underlying SDK to alias these from — the Apple `container` CLI
 * (https://github.com/apple/container) is the only interface, so this type
 * declares the subset of its flags this provider wires up.
 */
export interface ContainerSandboxCreateParams {
  /** OCI image reference. Defaults to `docker.io/library/ubuntu:24.04`. */
  readonly image?: string;
  /** Initial working directory inside the container. Defaults to `/root`. */
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  /** Bind mounts, e.g. to expose a host project directory read-write. */
  readonly mounts?: ReadonlyArray<ContainerMount>;
  /**
   * Ports to publish from the container to the host. A bare number publishes
   * that port to the same host port; use the object form to remap or to
   * publish udp.
   */
  readonly ports?: ReadonlyArray<number | ContainerPortMapping>;
  readonly cpus?: number;
  /** e.g. `"2G"`. */
  readonly memory?: string;
  /** Attach to a named network (see `container network create`). */
  readonly network?: string;
  readonly rosetta?: boolean;
  readonly dns?: string;
  /**
   * Command that keeps the container alive as a long-running session (the
   * container's PID 1). Defaults to `["sleep", "infinity"]`. Every actual
   * command runs via `container exec` against this container, so PID 1 only
   * needs to not exit.
   */
  readonly keepAliveCommand?: ReadonlyArray<string>;
  /** Path to the `container` binary. Defaults to `"container"` resolved via `PATH`. */
  readonly binaryPath?: string;
}

/**
 * Settings for {@link createContainerSandbox}. Two mutually-exclusive shapes:
 *
 * - `{ containerId }` — wrap an already-running container by name/id. The
 *   caller owns its lifecycle; `stop()`/`destroy()` are no-ops. There's no SDK
 *   object to introspect for its image/working directory/ports (unlike
 *   `@vercel/sandbox`'s `Sandbox` or `just-bash`'s `Sandbox`), so the caller
 *   supplies what's needed directly.
 * - {@link ContainerSandboxCreateParams} fields — provider runs
 *   `container run -d` on every `createSession()`, naming the container
 *   deterministically from `sessionId` when supplied so a later
 *   `resumeSession()` — even from a different process, since the container
 *   lives in the host-level `container-apiserver`, not this process — can
 *   find and restart it.
 */
export type ContainerSandboxSettings =
  | {
      containerId: string;
      cwd?: string;
      ports?: ReadonlyArray<number | ContainerPortMapping>;
      binaryPath?: string;
    }
  | (ContainerSandboxCreateParams & { containerId?: never; name?: string });

const CONTAINER_PROVIDER_ID = "apple-container-sandbox";
const NAME_PREFIX = "ai-sdk-harness";
const DEFAULT_IMAGE = "docker.io/library/ubuntu:24.04";
const DEFAULT_CWD = "/root";
const DEFAULT_KEEP_ALIVE_COMMAND = ["sleep", "infinity"];

function sessionContainerName(sessionId: string): string {
  return toContainerName(`${NAME_PREFIX}-session`, sessionId);
}

function resolvePortMappings(
  ports: ReadonlyArray<number | ContainerPortMapping> | undefined,
): ResolvedPortMapping[] {
  return (ports ?? []).map((port) =>
    typeof port === "number"
      ? { containerPort: port, hostPort: port, protocol: "tcp" as const }
      : {
          containerPort: port.containerPort,
          hostPort: port.hostPort ?? port.containerPort,
          protocol: port.protocol ?? "tcp",
        },
  );
}

export function createContainerSandbox(
  settings: ContainerSandboxSettings = {} as ContainerSandboxSettings,
): HarnessV1SandboxProvider {
  return new ContainerSandboxProvider(settings);
}

/**
 * `HarnessV1SandboxProvider` implementation backed by the Apple `container`
 * CLI (https://github.com/apple/container) — real Linux containers running
 * locally as lightweight per-container VMs, no remote infrastructure and no
 * hosted account required. Construct one via {@link createContainerSandbox}
 * at module scope and pass it to a `HarnessAgent`, exactly like
 * `createVercelSandbox`/`createJustBashSandbox`.
 *
 * Because each session's container is a real, host-level resource managed by
 * `container-apiserver` — not an in-process object — `resumeSession` is
 * genuinely durable across process restarts (unlike
 * `@workspace/sandbox-just-bash`, whose in-memory sandboxes cannot survive
 * one): the container keeps running (or can be `container start`ed back up)
 * independently of this Node process.
 */
export class ContainerSandboxProvider implements HarnessV1SandboxProvider {
  readonly specificationVersion = "harness-sandbox-v1" as const;
  readonly providerId = CONTAINER_PROVIDER_ID;

  constructor(private readonly settings: ContainerSandboxSettings) {}

  private get cli(): ContainerCliOptions {
    return { binaryPath: this.settings.binaryPath };
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

    if ("containerId" in this.settings && this.settings.containerId) {
      return new ContainerNetworkSandboxSession({
        containerName: this.settings.containerId,
        image: "(existing container)",
        cli: this.cli,
        ownsLifecycle: false,
        defaultWorkingDirectory: this.settings.cwd ?? DEFAULT_CWD,
        portMappings: resolvePortMappings(this.settings.ports),
      });
    }

    const params = this.settings as ContainerSandboxCreateParams & { name?: string };
    const image = params.image ?? DEFAULT_IMAGE;
    const cwd = params.cwd ?? DEFAULT_CWD;
    const portMappings = resolvePortMappings(params.ports);
    const containerName =
      params.name ??
      (options?.sessionId ? sessionContainerName(options.sessionId) : toContainerName(NAME_PREFIX, randomUUID()));

    await runContainerCliChecked(
      buildRunArgs({
        containerName,
        image,
        cwd,
        env: params.env,
        mounts: params.mounts,
        portMappings,
        cpus: params.cpus,
        memory: params.memory,
        network: params.network,
        rosetta: params.rosetta,
        dns: params.dns,
        keepAliveCommand: params.keepAliveCommand ?? DEFAULT_KEEP_ALIVE_COMMAND,
      }),
      { binaryPath: this.cli.binaryPath, abortSignal: options?.abortSignal },
    );

    const session = new ContainerNetworkSandboxSession({
      containerName,
      image,
      cli: this.cli,
      ownsLifecycle: true,
      defaultWorkingDirectory: cwd,
      portMappings,
    });

    // No snapshot/template mechanism exists for this CLI, so — like
    // `@workspace/sandbox-just-bash` — `onFirstCreate` just runs immediately
    // after the fresh container comes up, regardless of `identity`.
    if (options?.onFirstCreate != null) {
      await options.onFirstCreate(session.restricted(), { abortSignal: options?.abortSignal });
    }

    return session;
  };

  resumeSession = async (options: {
    sessionId: string;
    abortSignal?: AbortSignal;
  }): Promise<HarnessV1NetworkSandboxSession> => {
    options.abortSignal?.throwIfAborted();

    if ("containerId" in this.settings && this.settings.containerId) {
      return new ContainerNetworkSandboxSession({
        containerName: this.settings.containerId,
        image: "(existing container)",
        cli: this.cli,
        ownsLifecycle: false,
        defaultWorkingDirectory: this.settings.cwd ?? DEFAULT_CWD,
        portMappings: resolvePortMappings(this.settings.ports),
      });
    }

    const params = this.settings as ContainerSandboxCreateParams;
    const containerName = sessionContainerName(options.sessionId);

    // Best-effort: a container that was left running doesn't need (and will
    // error on) a redundant start, so a failure here is not fatal on its own —
    // the health check below is the real signal of whether resume succeeded.
    await runContainerCli(["start", containerName], {
      binaryPath: this.cli.binaryPath,
      abortSignal: options.abortSignal,
    }).catch(() => {});

    const health = await runContainerCli(buildExecArgs({ containerName, command: ["true"] }), {
      binaryPath: this.cli.binaryPath,
      abortSignal: options.abortSignal,
    });
    if (health.exitCode !== 0) {
      throw new Error(
        `No resumable container sandbox found for session "${options.sessionId}" ` +
          `(looked for container "${containerName}"). ${health.stderr.toString("utf-8").trim()}`,
      );
    }

    return new ContainerNetworkSandboxSession({
      containerName,
      image: params.image ?? DEFAULT_IMAGE,
      cli: this.cli,
      ownsLifecycle: true,
      defaultWorkingDirectory: params.cwd ?? DEFAULT_CWD,
      portMappings: resolvePortMappings(params.ports),
    });
  };
}
