import { mkdirSync } from "node:fs";
import path from "node:path";

// better-sqlite3 (and drizzle-kit's own connection) refuse to open a local
// sqlite file if its parent directory doesn't exist yet — unlike unstorage's
// fs driver, which creates it on demand.
export function ensureLocalDbDir(databasePath: string): void {
  mkdirSync(path.dirname(databasePath), { recursive: true });
}
