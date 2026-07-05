import path from "node:path";
import { z } from "zod";
import { loadConfigSync } from "zod-config";
import { envAdapter } from "zod-config/env-adapter";

export const config = loadConfigSync({
  schema: z.object({
    OPENCODE_API_KEY: z.string(),
    OPENCODE_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1/"),
    WORKFLOW_TARGET_WORLD: z.string(),
    HARNESS_DATA_DIR: z
      .string()
      .default(process.cwd())
      .transform((dir) => path.resolve(dir)),
    HARNESS_API_ORIGIN: z.string().default("https://api.localhost"),
  }),
  adapters: [envAdapter()],
});
