import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import { Readable } from "node:stream";
import {
  extractLines,
  type Experimental_SandboxProcess as SandboxProcess,
  type Experimental_SandboxSession as SandboxSession,
} from "@ai-sdk/provider-utils";
import {
  buildExecArgs,
  ContainerCommandError,
  type ContainerCliOptions,
  runContainerCli,
  shellQuote,
  spawnContainerCli,
} from "./container-cli";

/**
 * `Experimental_SandboxSession` implementation backed by a running Apple
 * `container` (https://github.com/apple/container) instance. This is the
 * tool-safe surface (file I/O, exec, spawn); it is what
 * `ContainerNetworkSandboxSession.restricted()` returns and is not
 * constructed directly by consumers. Every operation shells out to
 * `container exec <containerName> ...` — there is no persistent-shell state
 * (no tracked `cwd`/`env` across calls) because each call passes its own
 * `workingDirectory`/`env` straight through to `container exec`, exactly like
 * `@ai-sdk/sandbox-vercel` does against `sandbox.runCommand()`.
 */
export class ContainerSandboxSession implements SandboxSession {
  constructor(
    protected readonly containerName: string,
    protected readonly image: string,
    protected readonly cli: ContainerCliOptions,
  ) {}

  get description(): string {
    return [
      `Apple container sandbox (container: ${this.containerName}, image: ${this.image}).`,
      "Filesystem changes persist for the lifetime of the container.",
    ].join("\n");
  }

  async run({
    command,
    workingDirectory,
    env,
    abortSignal,
  }: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    abortSignal?.throwIfAborted();

    const args = buildExecArgs({
      containerName: this.containerName,
      command: ["bash", "-c", command],
      workingDirectory,
      env,
    });
    const result = await runContainerCli(args, { binaryPath: this.cli.binaryPath, abortSignal });

    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString("utf-8"),
      stderr: result.stderr.toString("utf-8"),
    };
  }

  async spawn({
    command,
    workingDirectory,
    env,
    abortSignal,
  }: {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    abortSignal?: AbortSignal;
  }): Promise<SandboxProcess> {
    abortSignal?.throwIfAborted();

    // `container exec`'s local client process may not propagate termination
    // to the process it started inside the container (the exec channel can
    // outlive the client, the same detached-process gap `docker exec` has).
    // Recording the real PID via `exec` (which replaces the shell's own PID
    // rather than forking) lets `kill()` reach it directly as a fallback.
    const pidFile = `/tmp/.harness-sandbox-${randomUUID()}.pid`;
    const wrappedCommand = `echo $$ > ${shellQuote(pidFile)}; exec ${command}`;

    const args = buildExecArgs({
      containerName: this.containerName,
      command: ["bash", "-c", wrappedCommand],
      workingDirectory,
      env,
    });
    const child = spawnContainerCli(args, { binaryPath: this.cli.binaryPath, abortSignal });

    return createSandboxProcess({
      child,
      containerName: this.containerName,
      pidFile,
      cli: this.cli,
      abortSignal,
    });
  }

  async readFile({
    path,
    abortSignal,
  }: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<Uint8Array> | null> {
    const bytes = await this.readBinaryFile({ path, abortSignal });
    if (bytes == null) return null;
    return bytesToStream(bytes);
  }

  async readBinaryFile({
    path,
    abortSignal,
  }: {
    path: string;
    abortSignal?: AbortSignal;
  }): Promise<Uint8Array | null> {
    abortSignal?.throwIfAborted();

    const args = buildExecArgs({ containerName: this.containerName, command: ["cat", path] });
    const result = await runContainerCli(args, { binaryPath: this.cli.binaryPath, abortSignal });

    if (result.exitCode !== 0) {
      if (isFileNotFoundStderr(result.stderr.toString("utf-8"))) return null;
      throw new ContainerCommandError(args, result.exitCode, result.stderr.toString("utf-8"));
    }

    return new Uint8Array(result.stdout.buffer, result.stdout.byteOffset, result.stdout.byteLength);
  }

  async readTextFile({
    path,
    encoding = "utf-8",
    startLine,
    endLine,
    abortSignal,
  }: {
    path: string;
    encoding?: string;
    startLine?: number;
    endLine?: number;
    abortSignal?: AbortSignal;
  }): Promise<string | null> {
    const bytes = await this.readBinaryFile({ path, abortSignal });
    if (bytes == null) return null;
    const text = Buffer.from(bytes).toString(encoding as BufferEncoding);
    return extractLines({ text, startLine, endLine });
  }

  async writeFile({
    path,
    content,
    abortSignal,
  }: {
    path: string;
    content: ReadableStream<Uint8Array>;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    const bytes = await collectStream(content);
    await this.writeBinaryFile({ path, content: bytes, abortSignal });
  }

  async writeBinaryFile({
    path,
    content,
    abortSignal,
  }: {
    path: string;
    content: Uint8Array;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    abortSignal?.throwIfAborted();

    const parent = posix.dirname(path);
    const script =
      parent && parent !== "." && parent !== "/"
        ? `mkdir -p ${shellQuote(parent)} && cat > ${shellQuote(path)}`
        : `cat > ${shellQuote(path)}`;

    const args = buildExecArgs({ containerName: this.containerName, command: ["bash", "-c", script] });
    const result = await runContainerCli(args, {
      binaryPath: this.cli.binaryPath,
      input: content,
      abortSignal,
    });

    if (result.exitCode !== 0) {
      throw new ContainerCommandError(args, result.exitCode, result.stderr.toString("utf-8"));
    }
  }

  async writeTextFile({
    path,
    content,
    encoding = "utf-8",
    abortSignal,
  }: {
    path: string;
    content: string;
    encoding?: string;
    abortSignal?: AbortSignal;
  }): Promise<void> {
    const buffer = Buffer.from(content, encoding as BufferEncoding);
    await this.writeBinaryFile({
      path,
      content: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
      abortSignal,
    });
  }
}

function createSandboxProcess(input: {
  child: ReturnType<typeof spawnContainerCli>;
  containerName: string;
  pidFile: string;
  cli: ContainerCliOptions;
  abortSignal?: AbortSignal;
}): SandboxProcess {
  const { child, containerName, pidFile, cli, abortSignal } = input;
  const stdout = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
  const stderr = Readable.toWeb(child.stderr) as ReadableStream<Uint8Array>;

  let killed = false;

  return {
    stdout,
    stderr,
    async wait(): Promise<{ exitCode: number }> {
      const exitCode = await new Promise<number>((resolve) => {
        child.on("close", (code) => resolve(code ?? -1));
      });
      if (abortSignal?.aborted) {
        throw abortSignal.reason ?? new DOMException("Aborted", "AbortError");
      }
      return { exitCode };
    },
    async kill(): Promise<void> {
      if (killed) return;
      killed = true;

      const killScript = `kill "$(cat ${shellQuote(pidFile)} 2>/dev/null)" 2>/dev/null || true`;
      await runContainerCli(
        buildExecArgs({ containerName, command: ["sh", "-c", killScript] }),
        { binaryPath: cli.binaryPath },
      ).catch(() => {});

      child.kill("SIGTERM");
    },
  };
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function isFileNotFoundStderr(stderr: string): boolean {
  return /no such file or directory|not found|does not exist/i.test(stderr);
}
