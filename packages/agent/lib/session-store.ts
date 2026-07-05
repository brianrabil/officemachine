import type { HarnessAgentResumeSessionState, HarnessAgentSession } from "@ai-sdk/harness/agent";

const states: Record<string, HarnessAgentResumeSessionState | undefined> = {};

type SessionFactory = {
  createSession(options?: {
    sessionId?: string;
    resumeFrom?: HarnessAgentResumeSessionState;
  }): Promise<HarnessAgentSession>;
};

export async function resumeOrCreateSession({
  agent,
  chatId,
}: {
  agent: SessionFactory;
  chatId: string;
}) {
  const resumeFrom = states[chatId];

  return agent.createSession(
    resumeFrom ? { sessionId: chatId, resumeFrom } : { sessionId: chatId },
  );
}

export async function detachAndPersist({
  chatId,
  session,
}: {
  chatId: string;
  session: HarnessAgentSession;
}) {
  states[chatId] = await session.detach();
}
