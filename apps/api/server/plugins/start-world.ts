import { definePlugin } from "nitro";

export default definePlugin(async () => {
  const { getWorld } = await import("workflow/runtime");
  const world = await getWorld();
  await world.start?.();
});
