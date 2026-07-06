import { defineConfig } from "nitro";
import { config } from "@workspace/config";

export default defineConfig({
  serverDir: "./server",
  modules: ["workflow/nitro"],
  experimental: {
    database: true,
    tasks: true,
    openAPI: true,
  },
  openAPI: {
    meta: {
      title: "Agent Harness API",
      version: "1.0.0",
      description: "API for the Agent Harness",
    },
  },
  database: {
    default: {
      // Real local SQLite (not libsql/Turso) so sqlite-sync's native
      // extension can be loaded via db0's getInstance() escape hatch —
      // see server/database/cloudsync.ts. bun-sqlite (not better-sqlite3):
      // this app runs on Bun, and Bun can't dlopen better-sqlite3's native
      // addon (oven-sh/bun#4290) — bun:sqlite is Bun's own binding.
      connector: "bun-sqlite",
      options: {
        path: config.DATABASE_PATH,
      },
    },
  },
  storage: {
    default: {
      driver: "fs",
      base: config.APP_CONFIG_DIR,
    },
  },
});
