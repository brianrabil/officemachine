import { defineHandler } from "nitro";
import { useDatabase } from "nitro/database";
import type { ChatSummary } from "#server/schema.ts";

export default defineHandler(async (): Promise<ChatSummary[]> => {
  const db = useDatabase();

  const { rows } = await db.sql<{ rows?: ChatSummary[] }>`
    SELECT
      chats.id as id,
      chats.created_at as createdAt,
      COUNT(messages.id) as messageCount,
      MAX(messages.created_at) as lastMessageAt
    FROM chats
    LEFT JOIN messages ON messages.chat_id = chats.id
    GROUP BY chats.id
    ORDER BY chats.created_at DESC
  `;

  return rows ?? [];
});
