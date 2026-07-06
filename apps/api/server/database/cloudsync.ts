import { Database } from "bun:sqlite";
import { getExtensionPath } from "@sqliteai/sqlite-sync";
import { config } from "@workspace/config";

const SYNCED_TABLES = ["chats", "messages"];

// db0's Database.getInstance() is typed as unknown because it's generic over
// any connector — this narrows it back to the concrete bun:sqlite instance
// we know nitro.config.ts's "bun-sqlite" connector produces, via a real
// runtime check rather than a type assertion.
function assertBunSqliteInstance(instance: unknown): asserts instance is Database {
  if (!(instance instanceof Database)) {
    throw new Error("Expected the default database connector to be bun-sqlite (see nitro.config.ts).");
  }
}

// Loads sqlite-sync into the app's local SQLite connection and turns each
// synced table into a CRDT-tracked, offline-first replica. Safe to call
// every time the app starts: cloudsync_init is skipped for tables that are
// already enabled, and cloudsync_network_init/set_apikey/sync only run when
// SQLite Cloud credentials are configured, so this is a no-op network-wise
// until you point it at a real project.
export function initCloudSync(instance: unknown): void {
  assertBunSqliteInstance(instance);
  const db = instance;
  db.loadExtension(getExtensionPath());

  for (const table of SYNCED_TABLES) {
    const status = db.query<{ enabled: number }, [string]>(
      "SELECT cloudsync_is_enabled(?) AS enabled",
    ).get(table);
    if (status?.enabled !== 1) {
      db.query("SELECT cloudsync_init(?)").run(table);
    }
  }

  if (!config.SQLITE_CLOUD_CONNECTION_STRING) return;

  db.query("SELECT cloudsync_network_init(?)").run(config.SQLITE_CLOUD_CONNECTION_STRING);
  if (config.SQLITE_CLOUD_API_KEY) {
    db.query("SELECT cloudsync_network_set_apikey(?)").run(config.SQLITE_CLOUD_API_KEY);
  }
}

export function pushCloudSync(instance: unknown): boolean {
  assertBunSqliteInstance(instance);
  if (!config.SQLITE_CLOUD_CONNECTION_STRING) return false;
  instance.query("SELECT cloudsync_network_sync()").run();
  return true;
}
