import type { HarnessV1ResumeSessionState } from "@ai-sdk/harness";

const sessionKey = (sessionId: string) => `sessions:${sessionId}`;

export async function loadResumeStep(
  sessionId: string,
): Promise<HarnessV1ResumeSessionState | undefined> {
  "use step";

  const { useStorage } = await import("nitro/storage");

  const state = await useStorage("default").getItem<HarnessV1ResumeSessionState>(
    sessionKey(sessionId),
  );
  return state ?? undefined;
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

  const { useStorage } = await import("nitro/storage");

  await useStorage("default").setItem(sessionKey(sessionId), resumeState);
}
