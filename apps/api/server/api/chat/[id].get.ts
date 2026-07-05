import { defineHandler } from "nitro";
import { asc, eq } from "drizzle-orm";
import type { HarnessMessage } from "@workspace/agent/agent";
import { db } from "@workspace/storage/db";
import { messages } from "@workspace/storage/schema";

export default defineHandler(async (event): Promise<HarnessMessage[]> => {
  const { id } = event.context.params as { id: string };

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(asc(messages.createdAt));

  return rows;
});
