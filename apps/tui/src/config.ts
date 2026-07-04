import { z } from "zod";
import { loadConfig } from "zod-config";
import { envAdapter } from "zod-config/env-adapter";

export const config = await loadConfig({
  schema: z.object({
    OPENCODE_API_KEY: z.string(),
    OPENCODE_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1/"),
  }),
  adapters: [envAdapter()],
});
