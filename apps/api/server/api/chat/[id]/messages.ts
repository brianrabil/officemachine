import { defineHandler } from "nitro";
import { getValidatedRouterParams } from "h3";
import { useDatabase } from "nitro/database";
import type { HarnessMessage } from "@workspace/agent/agent";

export default defineHandler(async (event): Promise<HarnessMessage[]> => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema);
  const db = useDatabase();

  const { rows } = await db.sql<{ rows: { id: string; role: HarnessMessage["role"]; parts: string }[] }>`
    SELECT id, role, parts FROM messages WHERE chat_id = ${id} ORDER BY created_at ASC
  `;

  return rows.map((row) => ({ ...row, parts: JSON.parse(row.parts) }));
});
