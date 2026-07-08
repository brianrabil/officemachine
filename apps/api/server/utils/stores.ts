import { useStorage } from "nitro/storage";

export async function useSessions() {
  return await useStorage("harness-sessions");
}

export interface ChatRun {
  readonly runId: string;
  readonly prompt: string;
}

export async function useChatRuns() {
  return await useStorage("chat-runs");
}

export async function appendChatRun(chatId: string, run: ChatRun): Promise<void> {
  const runs = await useChatRuns();
  const existing = (await runs.getItem<ChatRun[]>(chatId)) ?? [];
  await runs.setItem(chatId, [...existing, run]);
}

export async function listChatRuns(chatId: string): Promise<ChatRun[]> {
  const runs = await useChatRuns();
  return (await runs.getItem<ChatRun[]>(chatId)) ?? [];
}
