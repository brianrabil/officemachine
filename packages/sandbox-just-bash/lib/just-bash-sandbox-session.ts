import { isAbsolute, posix } from "node:path";
import {
  extractLines,
  type Experimental_SandboxSession,
  type Experimental_SandboxProcess,
} from "@ai-sdk/provider-utils";
import type { Sandbox, SandboxCommand } from "just-bash";
import type { JustBashSessionState } from "./session-store";

/**
 * `Experimental_SandboxSession` implementation backed by a `just-bash`
 * `Sandbox`. File operations and spawned processes share the same in-memory
 * filesystem, so a bridge process spawned via `spawn` can read files the host
 * wrote via `writeTextFile` (and vice versa).
 *
 * `run()` calls `sandbox.bashEnvInstance.exec()` directly (not
 * `sandbox.runCommand()`, which wraps every command as a nested `bash -c`
 * invocation — itself isolated from the outer exec's state, so `cd`/`export`
 * inside it never even reached `just-bash`'s own per-call-isolated state).
 * `state` is threaded through by reference and updated after every `run()`
 * call, so consecutive calls on the same session see each other's `cd`,
 * `export`, and `alias` — see {@link JustBashSessionState}'s doc comment for
 * why that requires tracking it ourselves.
 *
 * This is the tool-safe surface returned by
 * `JustBashNetworkSandboxSession.restricted()` — not constructed directly by
 * consumers.
 */
export class JustBashSandboxSession implements Experimental_SandboxSession {
  constructor(
    protected readonly sandbox: Sandbox,
    protected readonly state: JustBashSessionState,
  ) {}

  get description(): string {
    return [
      "just-bash JavaScript bash environment with a virtual filesystem.",
      "Filesystem changes and spawned processes share the same in-memory state.",
      `Current working directory: ${this.state.cwd}`,
    ].join("\n");
  }

  private resolvePath(path: string): string {
    return isAbsolute(path) ? path : posix.join(this.state.cwd, path);
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

    const result = await this.sandbox.bashEnvInstance.exec(command, {
      cwd: workingDirectory ?? this.state.cwd,
      env: { ...this.state.env, ...env },
      ...(abortSignal !== undefined ? { signal: abortSignal } : {}),
    });

    // Thread the resulting cwd (via PWD)/env forward so the next run() call
    // on this session continues from here instead of resetting.
    this.state.cwd = result.env.PWD ?? this.state.cwd;
    this.state.env = result.env;

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
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
  }): Promise<Experimental_SandboxProcess> {
    abortSignal?.throwIfAborted();

    // Detached/background — matches real bash `&` semantics: forks a copy of
    // the current cwd/env at launch time, but (unlike run()) never feeds
    // anything back into the session's tracked state once it finishes.
    const live = await this.sandbox.runCommand({
      cmd: "bash",
      args: ["-c", command],
      detached: true,
      cwd: workingDirectory ?? this.state.cwd,
      env: { ...this.state.env, ...env },
      ...(abortSignal !== undefined ? { signal: abortSignal } : {}),
    });

    return createSandboxProcess(live, abortSignal);
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
    const resolved = this.resolvePath(path);
    try {
      const bytes = await this.sandbox.bashEnvInstance.fs.readFileBuffer(resolved);
      return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    } catch (error) {
      if (isFileNotFoundError(error)) return null;
      throw error;
    }
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
    const resolved = this.resolvePath(path);
    await this.sandbox.bashEnvInstance.fs.writeFile(resolved, content);
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

function createSandboxProcess(
  command: SandboxCommand,
  abortSignal: AbortSignal | undefined,
): Experimental_SandboxProcess {
  const encoder = new TextEncoder();
  const controllers: {
    stdout?: ReadableStreamDefaultController<Uint8Array>;
    stderr?: ReadableStreamDefaultController<Uint8Array>;
  } = {};

  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      controllers.stdout = controller;
    },
  });

  const stderr = new ReadableStream<Uint8Array>({
    start(controller) {
      controllers.stderr = controller;
    },
  });

  const drained = (async () => {
    try {
      for await (const message of command.logs()) {
        const target = message.type === "stdout" ? controllers.stdout : controllers.stderr;
        target?.enqueue(encoder.encode(message.data));
      }
      controllers.stdout?.close();
      controllers.stderr?.close();
    } catch (error) {
      controllers.stdout?.error(error);
      controllers.stderr?.error(error);
    }
  })();

  return {
    stdout,
    stderr,
    async wait(): Promise<{ exitCode: number }> {
      const finished = await command.wait();
      await drained;
      if (abortSignal?.aborted) {
        throw abortSignal.reason ?? new DOMException("Aborted", "AbortError");
      }
      return { exitCode: finished.exitCode };
    },
    async kill(): Promise<void> {
      await command.kill();
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

function isFileNotFoundError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === "ENOENT") return true;
  const message = (error as { message?: unknown }).message;
  return (
    typeof message === "string" && /no such file|not found|does not exist|ENOENT/i.test(message)
  );
}
