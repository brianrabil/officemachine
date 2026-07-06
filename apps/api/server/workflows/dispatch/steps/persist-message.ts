import type { HarnessMessage } from "@workspace/agent/agent";

export async function persistMessage({
  chatId,
  message,
}: {
  chatId: string;
  message: HarnessMessage;
}): Promise<void> {
  "use step";

  const { useDatabase } = await import("nitro/database");
  const db = useDatabase();
  const nowSeconds = Math.floor(Date.now() / 1000);

  await db.sql`INSERT INTO chats (id, created_at) VALUES (${chatId}, ${nowSeconds}) ON CONFLICT DO NOTHING`;
  await db.sql`
    INSERT INTO messages (id, chat_id, role, parts, created_at)
    VALUES (${message.id}, ${chatId}, ${message.role}, ${JSON.stringify(message.parts)}, ${nowSeconds})
  `;
}
