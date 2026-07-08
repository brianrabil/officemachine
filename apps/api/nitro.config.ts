import { defineConfig } from "nitro";
import { env } from "@workspace/config/env";

export default defineConfig({
  serverDir: "./server",
  modules: ["workflow/nitro"],
  experimental: {
    openAPI: true,
  },
  openAPI: {
    meta: {
      title: "Officemachine API",
      version: "1.0.0",
      description: "API for Officemachine",
    },
  },
  storage: {
    default: {
      driver: "fs",
      base: env.APP_CONFIG_DIR,
    },
  },
  devStorage: {
    db: {
      driver: "fs",
      base: "./.data/db",
    },
  },
});
