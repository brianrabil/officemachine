import type { HarnessV1ResumeSessionState } from "@ai-sdk/harness";

const sessionKey = (sessionId: string) => `sessions:${sessionId}`;

export async function loadResumeStep(
  sessionId: string,
): Promise<HarnessV1ResumeSessionState | undefined> {
  "use step";

  const { getItem } = await import("@workspace/config/files");

  return getItem<HarnessV1ResumeSessionState>(sessionKey(sessionId));
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

  const { setItem } = await import("@workspace/config/files");

  await setItem(sessionKey(sessionId), resumeState);
}
