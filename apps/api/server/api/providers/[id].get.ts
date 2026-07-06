import { defineHandler, HTTPError } from "nitro";
import { getValidatedRouterParams } from "h3";
import { getProvider } from "#server/utils/gateway.ts";
import { idParamsSchema } from "#server/schema.ts";

export default defineHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, idParamsSchema);
  const provider = await getProvider(id);
  if (!provider) {
    throw new HTTPError(`Unknown provider: ${id}`, { status: 404 });
  }
  return provider;
});
