import { defineConfig } from "drizzle-kit";
import { config } from "@workspace/config";

export default defineConfig({
  dialect: "turso",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: config.DATABASE_URL,
    authToken: config.DATABASE_AUTH_TOKEN,
  },
});
