import { defineConfig } from "nitro";
import { env } from "@workspace/config/env";

export default defineConfig({
  serverDir: "./server",
  modules: ["workflow/nitro"],
  imports: {},
  typescript: {
    generatedTypesDir: ".nitro/types",
  },
  openAPI: {
    meta: {
      title: "Agent Harness API",
      version: "1.0.0",
      description: "API for the Agent Harness",
    },
  },
  experimental: {
    database: true,
    tasks: true,
    openAPI: true,
  },
  database: {
    default: {
      connector: "bun-sqlite",
      options: { name: "db" },
    },
  },
  storage: {
    default: {
      driver: "fs",
      base: env.APP_CONFIG_DIR,
    },
  },
});
