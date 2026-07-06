import { defineConfig } from "drizzle-kit";
import { config } from "@workspace/config";
import { ensureLocalDbDir } from "./server/database/local-db-path";

ensureLocalDbDir(config.DATABASE_PATH);

export default defineConfig({
  dialect: "sqlite",
  schema: "./server/database/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: config.DATABASE_PATH,
  },
});
