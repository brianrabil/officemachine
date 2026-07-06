import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { HarnessMessage } from "@workspace/agent/agent";

// sqlite-sync's cloudsync_init requires every non-primary-key NOT NULL
// column to declare a DEFAULT, so the CRDT engine can materialize a value
// for merges — see apps/api/server/database/cloudsync.ts. Application code
// always supplies an explicit value on insert; these defaults exist purely
// to satisfy that constraint.
export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .default("")
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["system", "user", "assistant"] }).notNull().default("user"),
  parts: text("parts", { mode: "json" })
    .$type<HarnessMessage["parts"]>()
    .notNull()
    .default(sql`(json_array())`),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
