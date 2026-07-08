import { defineHandler } from "nitro";
import { getValidatedQuery } from "h3";
import { getRun } from "workflow/api";
import { readUIMessageStream, type UIMessageChunk } from "ai";
import { listChatRuns } from "#server/utils/stores.ts";
import type { HarnessMessage } from "@workspace/agent/harness";
import z from "zod";

async function readFinalAssistantMessage(runId: string): Promise<HarnessMessage | undefined> {
  const run = getRun(runId);
  const stream = run.getReadable<UIMessageChunk>({ startIndex: 0 });

  let last: HarnessMessage | undefined;
  for await (const message of readUIMessageStream<HarnessMessage>({ stream })) {
    last = message;
  }
  return last;
}

export default defineHandler(async (event): Promise<HarnessMessage[]> => {
  const { id } = await getValidatedQuery(event, z.object({ id: z.string() }));
  const runs = await listChatRuns(id);

  const messages: HarnessMessage[] = [];
  for (const { runId, prompt } of runs) {
    const userMessage: HarnessMessage = {
      id: `${runId}-user`,
      role: "user",
      parts: [{ type: "text", text: prompt }],
    };
    const assistantMessage = await readFinalAssistantMessage(runId);

    messages.push(userMessage);
    if (assistantMessage) {
      messages.push(assistantMessage);
    }
  }

  return messages;
});
