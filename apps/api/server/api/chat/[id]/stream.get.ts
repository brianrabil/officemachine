import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { getValidatedQuery, getValidatedRouterParams } from "h3";
import { defineHandler } from "nitro";
import { getRun } from "workflow/api";
import { z } from "zod";

export default defineHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.string().min(1) }));
  const { startIndex } = await getValidatedQuery(
    event,
    z.object({ startIndex: z.coerce.number().int().optional() }),
  );
  const readable = getRun(id).getReadable<UIMessageChunk>({ startIndex });
  const tailIndex = await readable.getTailIndex();

  return createUIMessageStreamResponse({
    stream: readable,
    headers: {
      "x-workflow-stream-tail-index": String(tailIndex),
    },
  });
});
