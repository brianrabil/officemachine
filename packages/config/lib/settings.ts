import { z } from "zod";
import { loadConfigSync } from "zod-config";
import { json5Adapter } from "zod-config/json5-adapter";
import path from "node:path";
import { env } from "./env";

export const settings = loadConfigSync({
  schema: z.object({
    defaultProvider: z.string().default("opencode-go"),
    defaultModel: z.string().default("deepseek-v4-flash"),
  }),
  adapters: [
    json5Adapter({
      path: path.join(env.APP_CONFIG_DIR, "settings.json5"),
      silent: true,
    }),
  ],
});
