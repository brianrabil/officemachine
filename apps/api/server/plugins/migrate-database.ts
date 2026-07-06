import { definePlugin } from "nitro";
import { useDatabase } from "nitro/database";

export default definePlugin(async () => {
  const db = useDatabase();

  await db.sql`PRAGMA foreign_keys = ON`;

  await db.sql`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `;

  await db.sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      parts TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `;
});
