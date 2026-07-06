import { defineHandler } from "nitro";
import { useDatabase } from "nitro/database";
import { getValidatedRouterParams } from "h3";
import type { HarnessMessage } from "@workspace/agent/agent";
import { idParamsSchema } from "#server/schema.ts";

export default defineHandler(async (event): Promise<HarnessMessage[]> => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema);
  const db = useDatabase();

  const { rows } = await db.sql<{
    rows?: { id: string; chatId: string; role: string; parts: string; createdAt: number }[];
  }>`
    SELECT id, chat_id as chatId, role, parts, created_at as createdAt
    FROM messages
    WHERE chat_id = ${id}
    ORDER BY created_at ASC
  `;

  return (rows ?? []).map((row) => ({
    ...row,
    parts: JSON.parse(row.parts),
  })) as unknown as HarnessMessage[];
});
