import { runAgentTUI as _runAgentTUI } from "@workspace/agent-tui/index";
import { env } from "@workspace/config/env";
import type { HarnessMessage } from "@workspace/agent/agent";
import { createRemoteHarnessAgent } from "./create-remote-agent";

export async function runAgentTUI() {
  let initialMessages: HarnessMessage[] = [];

  const baseUrl = env.APP_API_URL;
  const resumeChatId = process.argv[2];
  const chatId = resumeChatId ?? crypto.randomUUID();

  if (resumeChatId) {
    const res = await fetch(`${baseUrl}/api/chat/${chatId}/messages`);
    if (res.ok) {
      initialMessages = (await res.json()) as HarnessMessage[];
    } else {
      console.log(`Chat ${chatId} not found — starting fresh under that id.`);
    }
  } else {
    console.log(`Starting new chat ${chatId} — resume later with: pnpm run cli:dev ${chatId}`);
  }

  await _runAgentTUI({
    title: "Pi",
    agent: createRemoteHarnessAgent({
      baseUrl,
      chatId,
    }),
    initialMessages,
    tools: "auto-collapsed",
    reasoning: "auto-collapsed",
  });
}
