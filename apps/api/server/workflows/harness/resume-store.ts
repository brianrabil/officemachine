import type { HarnessV1Prompt, HarnessV1ResumeSessionState } from "@ai-sdk/harness";

interface StoredSession {
  resumeState: HarnessV1ResumeSessionState;
  prompt: HarnessV1Prompt | undefined;
}

export async function loadResumeStep(
  sessionId: string,
): Promise<HarnessV1ResumeSessionState | undefined> {
  "use step";

  const { useSessions } = await import("#server/utils/stores.ts");

  const sessions = await useSessions();
  const stored = await sessions.getItem<StoredSession>(sessionId);

  return stored?.resumeState;
}

export async function persistResumeStep({
  sessionId,
  resumeState,
  prompt,
}: {
  sessionId: string;
  resumeState: HarnessV1ResumeSessionState | undefined;
  prompt: HarnessV1Prompt | undefined;
}): Promise<void> {
  "use step";

  if (!resumeState) return;
  const { useSessions } = await import("#server/utils/stores.ts");

  const sessions = await useSessions();
  await sessions.setItem<StoredSession>(sessionId, { resumeState, prompt });
}
