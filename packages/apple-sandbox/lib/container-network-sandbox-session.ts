import { HarnessCapabilityUnsupportedError, type HarnessV1NetworkSandboxSession } from "@ai-sdk/harness";
import type { Experimental_SandboxSession as SandboxSession } from "@ai-sdk/provider-utils";
import {
  type ContainerCliOptions,
  runContainerCli,
  type ResolvedPortMapping,
} from "./container-cli";
import { ContainerSandboxSession } from "./container-sandbox-session";

const CONTAINER_PROVIDER_ID = "apple-container-sandbox";

/** Bounded to [5s, 60s]. */
function idleCheckIntervalMs(idleTimeoutMs: number): number {
  return Math.max(Math.min(idleTimeoutMs / 4, 60_000), 5_000);
}

/** `HarnessV1NetworkSandboxSession` backed by a running Apple `container` instance. */
export class ContainerNetworkSandboxSession
  extends ContainerSandboxSession
  implements HarnessV1NetworkSandboxSession
{
  readonly id: string;
  readonly defaultWorkingDirectory: string;
  private readonly ownsLifecycle: boolean;
  private readonly portMappings: ReadonlyArray<ResolvedPortMapping>;
  private readonly activity: { lastActivityAt: number };
  private idleTimer?: ReturnType<typeof setInterval>;

  constructor(input: {
    containerName: string;
    image: string;
    cli: ContainerCliOptions;
    ownsLifecycle: boolean;
    defaultWorkingDirectory: string;
    portMappings: ReadonlyArray<ResolvedPortMapping>;
    idleTimeoutMs?: number;
  }) {
    const activity = { lastActivityAt: Date.now() };
    super(input.containerName, input.image, input.cli, {
      touch: () => {
        activity.lastActivityAt = Date.now();
      },
    });
    this.activity = activity;
    this.id = input.containerName;
    this.ownsLifecycle = input.ownsLifecycle;
    this.defaultWorkingDirectory = input.defaultWorkingDirectory;
    this.portMappings = input.portMappings;

    if (input.ownsLifecycle && input.idleTimeoutMs != null) {
      const idleTimeoutMs = input.idleTimeoutMs;
      this.idleTimer = setInterval(() => {
        if (Date.now() - this.activity.lastActivityAt >= idleTimeoutMs) {
          this.stop().catch(() => {});
        }
      }, idleCheckIntervalMs(idleTimeoutMs));
      this.idleTimer.unref?.();
    }
  }

  get ports(): ReadonlyArray<number> {
    return this.portMappings.map((mapping) => mapping.containerPort);
  }

  /** Shares the activity tracker with this session, so traffic through either view resets the idle clock. */
  restricted(): SandboxSession {
    return new ContainerSandboxSession(this.containerName, this.image, this.cli, {
      touch: () => {
        this.activity.lastActivityAt = Date.now();
      },
    });
  }

  getPortUrl = async (options: {
    port: number;
    protocol?: "http" | "https" | "ws";
  }): Promise<string> => {
    const mapping = this.portMappings.find((candidate) => candidate.containerPort === options.port);
    if (!mapping) {
      throw new HarnessCapabilityUnsupportedError({
        harnessId: CONTAINER_PROVIDER_ID,
        message: `Port ${options.port} is not published on this container. Published ports: [${this.ports.join(", ")}].`,
      });
    }
    const scheme = options.protocol === "ws" ? "ws" : "http";
    return `${scheme}://127.0.0.1:${mapping.hostPort}`;
  };

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  stop = async (): Promise<void> => {
    this.clearIdleTimer();
    if (!this.ownsLifecycle) return;
    await runContainerCli(["stop", this.containerName], { binaryPath: this.cli.binaryPath }).catch(() => {});
  };

  destroy = async (): Promise<void> => {
    this.clearIdleTimer();
    if (!this.ownsLifecycle) return;
    await runContainerCli(["stop", this.containerName], { binaryPath: this.cli.binaryPath }).catch(() => {});
    await runContainerCli(["delete", "--force", this.containerName], {
      binaryPath: this.cli.binaryPath,
    }).catch(() => {});
  };
}
