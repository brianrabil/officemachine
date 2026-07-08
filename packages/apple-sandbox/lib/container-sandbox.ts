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

export interface ContainerSandboxCreateParams {
  /** Defaults to `docker.io/library/ubuntu:24.04`. */
  readonly image?: string;
  /** Defaults to `/root`. */
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly mounts?: ReadonlyArray<ContainerMount>;
  readonly ports?: ReadonlyArray<number | ContainerPortMapping>;
  readonly cpus?: number;
  /** e.g. `"2G"`. */
  readonly memory?: string;
  readonly network?: string;
  readonly rosetta?: boolean;
  readonly dns?: string;
  /** Mounts the host's SSH agent socket into the container. */
  readonly ssh?: boolean;
  /** `container` has no native idle timeout; enforced in-process via polling. */
  readonly idleTimeoutMs?: number;
  /** Container's PID 1; every real command runs via `container exec`. Defaults to `["sleep", "infinity"]`. */
  readonly keepAliveCommand?: ReadonlyArray<string>;
  /** Defaults to `"container"` resolved via `PATH`. */
  readonly binaryPath?: string;
}

/**
 * Two mutually-exclusive shapes: `{ containerId }` wraps an already-running
 * container (caller owns its lifecycle); otherwise {@link ContainerSandboxCreateParams}
 * fields are used to `container run -d` one, named from `sessionId` so
 * `resumeSession()` can find it again later, even from another process.
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

export function createAppleContainer(
  settings: ContainerSandboxSettings = {},
): HarnessV1SandboxProvider {
  return new ContainerSandboxProvider(settings);
}

/** `HarnessV1SandboxProvider` backed by the Apple `container` CLI (https://github.com/apple/container). */
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

    const params: ContainerSandboxCreateParams & { name?: string } = this.settings;
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
        ssh: params.ssh,
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
      idleTimeoutMs: params.idleTimeoutMs,
    });

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

    const params: ContainerSandboxCreateParams = this.settings;
    const containerName = sessionContainerName(options.sessionId);

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
      idleTimeoutMs: params.idleTimeoutMs,
    });
  };
}
