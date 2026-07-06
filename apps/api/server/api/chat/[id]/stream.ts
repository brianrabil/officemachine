import { getRun } from "workflow/api";
import { defineHandler } from "nitro";
import { getValidatedQuery, getValidatedRouterParams } from "h3";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { useStorage } from "nitro/storage";

export default defineHandler(async (event) => {
  const { id: chatId } = await getValidatedRouterParams(event, idParamsSchema);
  const { startIndex } = await getValidatedQuery(event, chatStreamQuerySchema);

  const runId = await useStorage("default").getItem<string>(runIdKey(chatId));
  if (!runId) {
    return new Response("No active run for this chat", { status: 404 });
  }

  const run = getRun(runId);
  const readable = run.getReadable({ startIndex });
  const tailIndex = await readable.getTailIndex();

  return createUIMessageStreamResponse({
    stream: readable as ReadableStream<UIMessageChunk>,
    headers: { "x-workflow-stream-tail-index": String(tailIndex) },
  });
});
