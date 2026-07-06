import { createGatewayProvider } from "@ai-sdk/gateway";
import { env } from "@workspace/config/env";

export const gateway = createGatewayProvider({
  apiKey: env.AI_GATEWAY_API_KEY,
});
