import { start } from "workflow/api";
import { defineHandler } from "nitro";
import { getValidatedRouterParams, readValidatedBody } from "h3";
import { harnessWorkflow } from "#server/workflows/harness/workflow.ts";
import { appendChatRun } from "#server/utils/stores.ts";
import { createUIMessageStreamResponse } from "ai";
import z from "zod";

export default defineHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.string() }));
  const { message } = await readValidatedBody(event, z.object({ message: z.string() }));

  const run = await start(harnessWorkflow, [{ sessionId: id, prompt: message }]);
  await appendChatRun(id, { runId: run.runId, prompt: message });

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
});
