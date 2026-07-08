import { type ChildProcessByStdio, spawn } from "node:child_process";
import type { Readable } from "node:stream";

export interface ContainerCliOptions {
  readonly binaryPath?: string;
}

/** Thrown when the `container` binary itself can't be found — distinct from the command failing ({@link ContainerCommandError}). */
export class ContainerCliNotFoundError extends Error {
  constructor(binaryPath: string) {
    super(
      `Could not find the Apple container CLI ("${binaryPath}"). Install it from ` +
        `https://github.com/apple/container, then run "container system start" before ` +
        `creating a container sandbox.`,
    );
    this.name = "ContainerCliNotFoundError";
  }
}

/** Thrown when `container <args>` runs but exits non-zero. */
export class ContainerCommandError extends Error {
  readonly args: ReadonlyArray<string>;
  readonly exitCode: number | null;
  readonly stderr: string;

  constructor(args: ReadonlyArray<string>, exitCode: number | null, stderr: string) {
    super(`container ${args.join(" ")} exited with code ${exitCode}: ${stderr.trim()}`);
    this.name = "ContainerCommandError";
    this.args = args;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export interface ContainerRunResult {
  readonly exitCode: number;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

/** Runs `container <args>` to completion. Never rejects for a non-zero exit, only for a spawn-level failure. */
export function runContainerCli(
  args: ReadonlyArray<string>,
  options: {
    binaryPath?: string;
    input?: Uint8Array;
    abortSignal?: AbortSignal;
  } = {},
): Promise<ContainerRunResult> {
  const binaryPath = options.binaryPath ?? "container";
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      signal: options.abortSignal,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new ContainerCliNotFoundError(binaryPath));
      } else {
        reject(error);
      }
    });

    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? -1,
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks),
      });
    });

    if (options.input != null) {
      child.stdin.end(Buffer.from(options.input));
    } else {
      child.stdin.end();
    }
  });
}

/** Like {@link runContainerCli}, but throws {@link ContainerCommandError} on a non-zero exit. */
export async function runContainerCliChecked(
  args: ReadonlyArray<string>,
  options?: Parameters<typeof runContainerCli>[1],
): Promise<ContainerRunResult> {
  const result = await runContainerCli(args, options);
  if (result.exitCode !== 0) {
    throw new ContainerCommandError(args, result.exitCode, result.stderr.toString("utf-8"));
  }
  return result;
}

/** Spawns `container <args>` without waiting for it to finish, for long-running/streaming use. */
export function spawnContainerCli(
  args: ReadonlyArray<string>,
  options: { binaryPath?: string; abortSignal?: AbortSignal } = {},
): ChildProcessByStdio<null, Readable, Readable> {
  const binaryPath = options.binaryPath ?? "container";
  const child = spawn(binaryPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    signal: options.abortSignal,
  });
  return child;
}

export function toContainerName(prefix: string, id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return `${prefix}-${sanitized}`;
}

/** Safely single-quotes a value for embedding in a `bash -c` script. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface ContainerMount {
  /** Absolute path on the host to bind-mount into the container. */
  readonly source: string;
  /** Absolute path inside the container where `source` is mounted. */
  readonly target: string;
  readonly readonly?: boolean;
}

export interface ResolvedPortMapping {
  readonly containerPort: number;
  readonly hostPort: number;
  readonly protocol: "tcp" | "udp";
}

/** Builds the argv for `container run -d ...` that creates the long-lived container backing a session. */
export function buildRunArgs(input: {
  containerName: string;
  image: string;
  cwd: string;
  env?: Record<string, string>;
  mounts?: ReadonlyArray<ContainerMount>;
  portMappings: ReadonlyArray<ResolvedPortMapping>;
  cpus?: number;
  memory?: string;
  network?: string;
  rosetta?: boolean;
  dns?: string;
  /** Mounts the host's SSH agent socket. Read `$SSH_AUTH_SOCK` inside the container — don't hardcode its path, the CLI's docs get it wrong. */
  ssh?: boolean;
  keepAliveCommand: ReadonlyArray<string>;
}): string[] {
  const args = ["run", "-d", "--name", input.containerName, "-w", input.cwd];

  for (const [key, value] of Object.entries(input.env ?? {})) {
    args.push("-e", `${key}=${value}`);
  }
  for (const mount of input.mounts ?? []) {
    args.push("-v", `${mount.source}:${mount.target}${mount.readonly ? ":ro" : ""}`);
  }
  for (const port of input.portMappings) {
    args.push("-p", `${port.hostPort}:${port.containerPort}${port.protocol === "udp" ? "/udp" : ""}`);
  }
  if (input.cpus != null) args.push("-c", String(input.cpus));
  if (input.memory != null) args.push("-m", input.memory);
  if (input.network != null) args.push("--network", input.network);
  if (input.rosetta) args.push("--rosetta");
  if (input.dns != null) args.push("--dns", input.dns);
  if (input.ssh) args.push("--ssh");

  args.push(input.image, ...input.keepAliveCommand);
  return args;
}

/** Set `stdin: true` when piping data via `runContainerCli`'s `input` option — without `-i`, `container exec` silently drops it. */
export function buildExecArgs(input: {
  containerName: string;
  command: ReadonlyArray<string>;
  workingDirectory?: string;
  env?: Record<string, string>;
  detach?: boolean;
  stdin?: boolean;
}): string[] {
  const args = ["exec"];
  if (input.detach) args.push("-d");
  if (input.stdin) args.push("-i");
  if (input.workingDirectory) args.push("-w", input.workingDirectory);
  for (const [key, value] of Object.entries(input.env ?? {})) {
    args.push("-e", `${key}=${value}`);
  }
  args.push(input.containerName, ...input.command);
  return args;
}
