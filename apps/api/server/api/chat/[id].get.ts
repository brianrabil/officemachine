import { defineHandler } from "nitro";
import { asc, eq } from "drizzle-orm";
import { db } from "@workspace/db/client";
import { messages } from "@workspace/db/schema";

export default defineHandler(async (event) => {
  const { id } = event.context.params as { id: string };

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(asc(messages.createdAt));

  return rows;
});
