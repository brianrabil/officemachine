import type { HarnessV1ResumeSessionState } from "@ai-sdk/harness";
import { safeParseJSON } from "@ai-sdk/provider-utils";

const RESUME_DIR = ".harness-sessions";

function fileName(sessionId: string): string {
  return `${sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

export async function loadResumeStep(
  sessionId: string,
): Promise<HarnessV1ResumeSessionState | undefined> {
  "use step";

  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  let text: string;
  try {
    text = await readFile(join(process.cwd(), RESUME_DIR, fileName(sessionId)), "utf8");
  } catch {
    return undefined;
  }

  const parsed = await safeParseJSON({ text });

  return parsed.success ? (parsed.value as unknown as HarnessV1ResumeSessionState) : undefined;
}

export async function persistResumeStep({
  sessionId,
  resumeState,
}: {
  sessionId: string;
  resumeState: HarnessV1ResumeSessionState | undefined;
}): Promise<void> {
  "use step";

  if (!resumeState) return;

  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const dir = join(process.cwd(), RESUME_DIR);

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName(sessionId)), JSON.stringify(resumeState));
}
