import { defineHandler } from "nitro";
import { useSessions } from "#server/utils/stores.ts";

export default defineHandler(async () => {
  const sessions = await useSessions();
  return sessions.getKeys();
});
