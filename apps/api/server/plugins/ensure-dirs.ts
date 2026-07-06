import { mkdirSync } from "node:fs";
import { definePlugin } from "nitro";
import path from "node:path";
import { env } from "@workspace/config/env";

export default definePlugin(async () => {
  mkdirSync(path.join(env.APP_CONFIG_DIR, "skills"), { recursive: true });
  mkdirSync(path.join(env.APP_CONFIG_DIR, "commands"), { recursive: true });
  mkdirSync(path.join(env.APP_CONFIG_DIR, "sessions"), { recursive: true });
  mkdirSync(path.join(env.APP_CONFIG_DIR, "extensions"), { recursive: true });
  mkdirSync(path.join(env.APP_CONFIG_DIR, "files"), { recursive: true });
});
