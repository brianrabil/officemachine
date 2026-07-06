import { defineHandler } from "nitro";
import { useDatabase } from "nitro/database";

export default defineHandler(async (): Promise<ChatSummary[]> => {
  const db = useDatabase();

  const { rows } = await db.sql<{ rows: ChatSummary[] }>`
    SELECT
      chats.id AS id,
      chats.created_at AS createdAt,
      COUNT(messages.id) AS messageCount,
      MAX(messages.created_at) AS lastMessageAt
    FROM chats
    LEFT JOIN messages ON messages.chat_id = chats.id
    GROUP BY chats.id
    ORDER BY chats.created_at DESC
  `;

  return rows;
});
