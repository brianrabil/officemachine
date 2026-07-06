import { HarnessCapabilityUnsupportedError, type HarnessV1NetworkSandboxSession } from "@ai-sdk/harness";
import type { Experimental_SandboxSession as SandboxSession } from "@ai-sdk/provider-utils";
import {
  type ContainerCliOptions,
  runContainerCli,
  type ResolvedPortMapping,
} from "./container-cli";
import { ContainerSandboxSession } from "./container-sandbox-session";

const CONTAINER_PROVIDER_ID = "apple-container-sandbox";

/**
 * `HarnessV1NetworkSandboxSession` backed by a running Apple `container`
 * instance. The provider's `createSession()`/`resumeSession()` return one of
 * these. It extends {@link ContainerSandboxSession} with the infra surface
 * (ports, lifecycle). It owns the container's lifecycle only when the
 * provider created it; when the provider was given an existing `containerId`,
 * `stop()`/`destroy()` are no-ops (caller retains ownership) — mirroring
 * `@ai-sdk/sandbox-vercel`'s `VercelNetworkSandboxSession`.
 *
 * Network policy is not mutable post-creation with this CLI (unlike
 * `@vercel/sandbox`'s `NetworkPolicy`) — the container's network is fixed by
 * the `--network` flag passed at `container run` time — so `setNetworkPolicy`
 * and `setPorts` are omitted, same as `@workspace/sandbox-just-bash`.
 */
export class ContainerNetworkSandboxSession
  extends ContainerSandboxSession
  implements HarnessV1NetworkSandboxSession
{
  readonly id: string;
  readonly defaultWorkingDirectory: string;
  private readonly ownsLifecycle: boolean;
  private readonly portMappings: ReadonlyArray<ResolvedPortMapping>;

  constructor(input: {
    containerName: string;
    image: string;
    cli: ContainerCliOptions;
    ownsLifecycle: boolean;
    defaultWorkingDirectory: string;
    portMappings: ReadonlyArray<ResolvedPortMapping>;
  }) {
    super(input.containerName, input.image, input.cli);
    this.id = input.containerName;
    this.ownsLifecycle = input.ownsLifecycle;
    this.defaultWorkingDirectory = input.defaultWorkingDirectory;
    this.portMappings = input.portMappings;
  }

  get ports(): ReadonlyArray<number> {
    return this.portMappings.map((mapping) => mapping.containerPort);
  }

  /** Shares nothing mutable — a fresh reduced view over the same container. */
  restricted(): SandboxSession {
    return new ContainerSandboxSession(this.containerName, this.image, this.cli);
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
    // Published ports are plain loopback TCP with no TLS termination — "https"
    // is not a meaningful local scheme, so only the ws/http distinction matters.
    const scheme = options.protocol === "ws" ? "ws" : "http";
    return `${scheme}://127.0.0.1:${mapping.hostPort}`;
  };

  stop = async (): Promise<void> => {
    if (!this.ownsLifecycle) return;
    await runContainerCli(["stop", this.containerName], { binaryPath: this.cli.binaryPath }).catch(() => {});
  };

  destroy = async (): Promise<void> => {
    if (!this.ownsLifecycle) return;
    await runContainerCli(["stop", this.containerName], { binaryPath: this.cli.binaryPath }).catch(() => {});
    await runContainerCli(["delete", "--force", this.containerName], {
      binaryPath: this.cli.binaryPath,
    }).catch(() => {});
  };
}
