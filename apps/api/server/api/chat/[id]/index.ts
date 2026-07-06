import { start, getRun } from "workflow/api";
import { defineHandler } from "nitro";
import { getValidatedRouterParams, readValidatedBody } from "h3";
import { harnessWorkflow } from "#server/workflows/harness/workflow.ts";
import {
  harnessMessageHook,
  harnessHookToken,
} from "#server/workflows/harness/hooks/harness-message.ts";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { getItem, setItem, removeItem } from "@workspace/config/files";
import type { HarnessMessage } from "@workspace/agent/agent";
import { runIdKey } from "#server/utils/keys.ts";
import { idParamsSchema, chatMessageBodySchema } from "#server/schema.ts";

export default defineHandler(async (event) => {
  const { id: chatId } = await getValidatedRouterParams(event, idParamsSchema);
  const { message } = await readValidatedBody(event, chatMessageBodySchema);

  const runId = await getItem<string>(runIdKey(chatId));

  if (runId) {
    // An earlier message already has a workflow run alive, parked on this
    // chat's hook waiting for the next turn. Snapshot the tail *before*
    // resuming so we don't miss anything the new turn writes.
    const existingRun = getRun(runId);
    const tailIndex = await existingRun.getReadable().getTailIndex();
    let resumed = true;

    try {
      await harnessMessageHook.resume(harnessHookToken(chatId), {
        message: message as HarnessMessage,
      });
    } catch {
      // The hook token wasn't found — the run finished/expired without us
      // noticing. Fall through to starting a fresh workflow below.
      resumed = false;
      await removeItem(runIdKey(chatId));
    }

    if (resumed) {
      return createUIMessageStreamResponse({
        stream: existingRun.getReadable({
          startIndex: tailIndex,
        }) as ReadableStream<UIMessageChunk>,
        headers: { "x-workflow-run-id": runId },
      });
    }
  }

  const run = await start(harnessWorkflow, [
    { sessionId: chatId, message: message as HarnessMessage },
  ]);
  await setItem(runIdKey(chatId), run.runId);

  return createUIMessageStreamResponse({
    stream: run.readable as ReadableStream<UIMessageChunk>,
    headers: { "x-workflow-run-id": run.runId },
  });
});
