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
      title: "Officemachine API",
      version: "1.0.0",
      description: "API for Officemachine",
    },
  },
  experimental: {
    database: true,
    tasks: true,
    openAPI: true,
  },
  database: {
    default: {
      connector: "libsql",
      options: {
        url: env.APP_DATABASE_URL,
      },
    },
  },
  storage: {
    default: {
      driver: "fs",
      base: env.APP_CONFIG_DIR,
    },
  },
});
