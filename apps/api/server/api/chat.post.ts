import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { defineHandler } from "nitro";
import { agent } from "@workspace/agent/agent";
import { resumeOrCreateSession } from "@workspace/agent/session-store";

export default defineHandler(async ({ req }) => {
  const body = (await req.json()) as {
    id?: string;
    messages: UIMessage[];
  };

  if (!body.id) {
    throw new Error("Missing chat id");
  }

  const chatId = body.id;
  const messages = await convertToModelMessages(body.messages);
  const session = await resumeOrCreateSession({ agent, chatId });
  const result = await agent.stream({ session, messages });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
});
