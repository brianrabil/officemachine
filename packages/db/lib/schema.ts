import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { UIMessage } from "ai";

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["system", "user", "assistant"] }).notNull(),
  parts: text("parts", { mode: "json" }).$type<UIMessage["parts"]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
