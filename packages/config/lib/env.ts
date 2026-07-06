import { z } from "zod";
import { loadConfigSync } from "zod-config";
import { envAdapter } from "zod-config/env-adapter";
import path from "node:path";
import dotenvx from "@dotenvx/dotenvx";
import os from "node:os";

dotenvx.config({ convention: "nextjs" });

export const env = loadConfigSync({
  schema: z.object({
    // ─── Storage ─────────────────────────────────────────────────
    APP_CONFIG_DIR: z.string().default(path.join(os.homedir(), ".zero-harness")),
    APP_DATABASE_URL: z.string().default("file:app.db"),

    // ─── App URLs ────────────────────────────────────────────────
    APP_API_URL: z.string().default("https://api.localhost"),

    // ─── Pi Provider Auth ────────────────────────────────────────
    OPENCODE_API_KEY: z.string().optional(),
    OPENCODE_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1/"),
    AI_GATEWAY_API_KEY: z.string().optional(),
  }),
  adapters: [envAdapter()],
});
