import { useDatabase } from "nitro/database";
import type { HarnessMessage } from "@workspace/agent/harness";

export async function persistMessage({
  chatId,
  message,
}: {
  chatId: string;
  message: HarnessMessage;
}): Promise<void> {
  "use step";

  const db = useDatabase();

  await db.sql`INSERT INTO chats (id) VALUES (${chatId}) ON CONFLICT DO NOTHING`;
  await db.sql`
    INSERT INTO messages (id, chat_id, role, parts)
    VALUES (${message.id}, ${chatId}, ${message.role}, ${JSON.stringify(message.parts)})
  `;
}
