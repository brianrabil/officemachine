import path from "node:path";
import { createFiles } from "files-sdk";
import { fs } from "files-sdk/fs";
import { createFilesRouter } from "files-sdk/api";
import { defineHandler } from "nitro";
import { env } from "@workspace/config/env";

const files = createFiles({
  adapter: fs({
    root: path.join(env.APP_CONFIG_DIR, "files"),
  }),
});

const router = createFilesRouter({
  files,
  // No session/auth system exists in this app yet (single-user local
  // harness) — allow every operation unscoped. Add a real check (and
  // keyPrefix scoping) here once multi-user auth lands.
  authorize: () => {},
  // apps/web reaches this route through its own server-side rewrite proxy
  // (see apps/web/next.config.ts), which forwards the browser's original
  // Origin header — that won't match this route's own origin, so the
  // default same-origin check would reject every upload/delete/move. There's
  // no cookie-based session here for CSRF to forge in the first place, so
  // allow any origin until real auth exists.
  allowedOrigins: () => true,
  // The fs adapter has no urlBaseUrl configured, so url()/redirect downloads
  // would resolve to unfetchable file:// URLs — proxy every download instead.
  downloadMode: "proxy",
});

export default defineHandler((event) => router.handle(event.req));
