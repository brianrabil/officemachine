// PTY bridge: streams a PTY-attached process to the browser over a websocket
// so wterm (@wterm/react) can render it. Runs the apps/tui interactive TUI in
// a pseudo-terminal and relays bytes both ways.
//
// IMPORTANT: this must run under Node, not Bun — node-pty's PTY I/O doesn't
// work under the Bun runtime (it spawns but never emits data). The *child* it
// spawns is Bun (`bun run apps/tui`), which is fine.
import { WebSocketServer } from "ws";
import pty from "node-pty";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const tuiCwd = path.join(repoRoot, "apps", "tui");

const PORT = Number(process.env.PORT || 4600);
const BUN = process.env.BUN_BIN || `${process.env.HOME}/.bun/bin/bun`;
// Override for isolating the pipeline from the TUI, e.g. BRIDGE_CMD="bash".
const cmd = process.env.BRIDGE_CMD ?? BUN;
const args = process.env.BRIDGE_CMD ? [] : ["run", "./src/main.ts"];

const wss = new WebSocketServer({ port: PORT, path: "/pty" });
console.log(`terminal-bridge listening on ws://localhost:${PORT}/pty`);
console.log(`spawns: ${cmd} ${args.join(" ")} (cwd: ${tuiCwd})`);

wss.on("connection", (ws) => {
  const term = pty.spawn(cmd, args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: tuiCwd,
    env: { ...process.env, TERM: "xterm-256color" },
  });

  // PTY -> browser (utf8 bytes as a binary frame)
  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(Buffer.from(data, "utf8"));
  });

  // browser -> PTY (keystrokes) + resize control messages
  ws.on("message", (msg) => {
    const text = msg.toString();
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.type === "resize") {
        term.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {
      // not JSON — raw keystrokes
    }
    term.write(text);
  });

  ws.on("close", () => term.kill());
  term.onExit(() => {
    try {
      ws.close();
    } catch {}
  });
});
