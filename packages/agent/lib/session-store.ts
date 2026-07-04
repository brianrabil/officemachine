import type { HarnessAgentSession } from "@ai-sdk/harness/agent";

/**
 * just-bash's sandbox provider has no `resumeSession` — its virtual
 * filesystem only exists on this process's heap, so a detach/resume-token
 * cycle (the pattern for bridge-backed sandboxes like Vercel's) can never
 * reconnect. Instead, keep the live session object in memory and reuse it
 * across turns for the same chat id.
 */
const liveSessions = new Map<string, HarnessAgentSession>();

type SessionFactory = {
  createSession(options?: { sessionId?: string }): Promise<HarnessAgentSession>;
};

export async function resumeOrCreateSession({
  agent,
  chatId,
}: {
  agent: SessionFactory;
  chatId: string;
}): Promise<HarnessAgentSession> {
  const existing = liveSessions.get(chatId);
  if (existing) return existing;

  const session = await agent.createSession({ sessionId: chatId });
  liveSessions.set(chatId, session);
  return session;
}
