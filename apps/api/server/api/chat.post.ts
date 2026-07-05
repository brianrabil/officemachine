import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { defineHandler } from "nitro";
import { agent } from "@workspace/agent/agent";
import { detachAndPersist, resumeOrCreateSession } from "@workspace/agent/session-store";
import { db } from "@workspace/db/client";
import { chats, messages as messagesTable } from "@workspace/db/schema";

export default defineHandler(async ({ req }) => {
  const body = (await req.json()) as {
    id?: string;
    message: UIMessage;
  };

  if (!body.id) {
    throw new Error("Missing chat id");
  }

  // The harness session owns conversation memory internally — only the
  // latest message is sent as fresh input for this turn, not the full
  // history (see session-store.ts). @workspace/db separately stores every
  // UI message so the web app can hydrate a chat's history on navigation.
  const chatId = body.id;

  await db.insert(chats).values({ id: chatId, createdAt: new Date() }).onConflictDoNothing();
  await db.insert(messagesTable).values({
    id: body.message.id,
    chatId,
    role: body.message.role,
    parts: body.message.parts,
    createdAt: new Date(),
  });

  const messages = await convertToModelMessages([body.message]);
  const session = await resumeOrCreateSession({ agent, chatId });
  const result = await agent.stream({ session, messages });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      generateMessageId: generateId,
      onEnd: async ({ responseMessage }) => {
        await db.insert(messagesTable).values({
          id: responseMessage.id,
          chatId,
          role: responseMessage.role,
          parts: responseMessage.parts,
          createdAt: new Date(),
        });
        // Once the turn's stream finishes, park the session and persist its
        // resume state so the next request (this process or after a restart)
        // continues the same conversation.
        await detachAndPersist({ chatId, session });
      },
    }),
  });
});
