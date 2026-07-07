import { defineHandler } from "nitro";
import { getValidatedRouterParams } from "h3";
import { useDatabase } from "nitro/database";
import type { HarnessMessage } from "@workspace/agent/harness";

export default defineHandler(async (event): Promise<HarnessMessage[]> => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema);
  const db = useDatabase();

  const rows = await db.sql<HarnessMessage[]>`
    SELECT id, role, parts FROM messages WHERE chat_id = ${id} ORDER BY created_at ASC
  `;

  return rows.map((row) => ({ ...row, parts: row.parts }));
});
