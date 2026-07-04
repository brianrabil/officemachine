import { start } from "workflow/api";
import { defineEventHandler } from "nitro/h3";
import { codingWorkflow } from "#workflows/harness-workflow/workflow.ts";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { latestUserMessage } from "@workspace/agent/utils";

export default defineEventHandler(async ({ req }) => {
  const body = (await req.json()) as { id?: string; messages: UIMessage[] };

  if (!body.id) {
    return new Response("Missing chat ID", { status: 400 });
  }

  const prompt = latestUserMessage(await convertToModelMessages(body.messages));
  if (!prompt) {
    return new Response("No user message to run", { status: 400 });
  }

  const run = await start(codingWorkflow, [
    {
      prompt,
      sessionId: body.id,
    },
  ]);

  return createUIMessageStreamResponse({
    // NOTE: https://ai-sdk.dev/docs/ai-sdk-harnesses/workflow-utilities
    stream: run.readable as ReadableStream<UIMessageChunk>,
  });
});
