import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateId,
  toUIMessageStream,
} from "ai";
import { defineHandler } from "nitro";
import { agent, type HarnessMessage } from "@workspace/agent/agent";
import { detachAndPersist, resumeOrCreateSession } from "@workspace/agent/session-store";
import { config } from "@workspace/config";
import { db } from "@workspace/storage/db";
import { chats, messages as messagesTable } from "@workspace/storage/schema";

export default defineHandler(async ({ req }) => {
  const body = (await req.json()) as {
    id?: string;
    message: HarnessMessage;
  };

  if (!body.id) {
    throw new Error("Missing chat id");
  }

  // The harness session owns conversation memory internally — only the
  // latest message is sent as fresh input for this turn, not the full
  // history (see session-store.ts). @workspace/storage separately stores every
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

  // HarnessAgent's stream never emits a `type: "start"` part (unlike
  // streamText's), so attach metadata to the first chunk of any type instead.
  let sentInitialMetadata = false;

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<typeof agent.tools, HarnessMessage>({
      stream: result.stream,
      generateMessageId: generateId,
      messageMetadata: () => {
        if (!sentInitialMetadata) {
          sentInitialMetadata = true;
          return {
            createdAt: Date.now(),
            provider: config.DEFAULT_PROVIDER,
            modelId: config.DEFAULT_MODEL,
          };
        }
        return undefined;
      },
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
