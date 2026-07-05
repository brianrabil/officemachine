import { z } from "zod";
import { loadConfigSync } from "zod-config";
import { envAdapter } from "zod-config/env-adapter";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenvx from "@dotenvx/dotenvx";

dotenvx.config({ convention: "nextjs" });

// NOTE: Private const
const APP_PREFIX = "data";

// This package lives at <repo root>/packages/config/lib — anchor dev-default
// paths here rather than process.cwd(), which differs per app (apps/api vs
// apps/web vs apps/tui), so every app shares the same on-disk directory
// instead of each growing its own.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const config = loadConfigSync({
  schema: z.object({
    // ─── App Globals ─────────────────────────────────────────────
    APP_CONFIG_DIR: z
      .string()
      .default(`.${APP_PREFIX}`)
      .transform((arg) => path.resolve(REPO_ROOT, arg)),
    APP_API_URL: z.string().default("https://api.localhost"),
    APP_WEB_URL: z.string().default("https://web.localhost"),

    // ─── Storage ─────────────────────────────────────────────────
    DATABASE_URL: z.string().default(`file:${path.join(REPO_ROOT, `.${APP_PREFIX}`, "app.db")}`),
    DATABASE_AUTH_TOKEN: z.string().optional(),

    // ─── Vercel Workflows ────────────────────────────────────────
    // Vercel Workflows
    WORKFLOW_TARGET_WORLD: z
      .union([z.literal("@workflow-worlds/turso")])
      .default("@workflow-worlds/turso"),

    // ─── User Settings ───────────────────────────────────────────
    // TODO: Break user settings into seperate json5 zod-config
    DEFAULT_PROVIDER: z.string().default("opencode-go"),
    DEFAULT_MODEL: z.string().default("deepseek-v4-flash"),
    DEFAULT_THINKING_LEVEL: z
      .union([
        z.literal("off"),
        z.literal("minimal"),
        z.literal("low"),
        z.literal("medium"),
        z.literal("high"),
        z.literal("xhigh"),
      ])
      .default("off"),
    SESSION_DIR: z.string().default(path.join(REPO_ROOT, `.${APP_PREFIX}`, "sessions")),

    // ─── Pi Providers Auth ───────────────────────────────────────
    // TODO: Break user settings into seperate json5 zod-config
    OPENCODE_API_KEY: z.string().optional(),
    OPENCODE_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1/"),
    AI_GATEWAY_API_KEY: z.string().optional(),
  }),
  adapters: [envAdapter()],
});
