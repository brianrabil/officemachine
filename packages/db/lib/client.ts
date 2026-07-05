import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Anchor the local dev default to this package's own directory rather than
// process.cwd() — the cwd differs per app (apps/api vs apps/tui), which would
// otherwise silently split chat history across separate per-app db files.
const packageDir = path.dirname(fileURLToPath(import.meta.url));
const defaultLocalDbUrl = `file:${path.resolve(packageDir, "..", "local.db")}`;

const client = createClient({
  url: process.env.DATABASE_URL ?? defaultLocalDbUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client);
