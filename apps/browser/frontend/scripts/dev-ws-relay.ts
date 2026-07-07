/**
 * Dev-only relay for the session stream WebSocket.
 *
 * apps/browser/frontend runs as its own Next.js dev server, a different
 * origin from the agent-browser dashboard daemon it talks to. Next's
 * rewrites() only proxy plain HTTP, and the daemon's own WS server rejects
 * connections whose Origin header doesn't match its own origin exactly.
 * This relay sits in between: it accepts the browser's WS connection, opens
 * its own connection to the daemon with a spoofed Origin header, and pipes
 * messages both directions.
 */

const DAEMON_ORIGIN = process.env.DAEMON_URL || "http://localhost:4848";
const RELAY_PORT = Number(process.env.WS_RELAY_PORT || 3011);

interface RelayData {
  path: string;
  upstream: WebSocket | null;
}

Bun.serve<RelayData>({
  port: RELAY_PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    if (server.upgrade(req, { data: { path: url.pathname + url.search, upstream: null } })) {
      return;
    }
    return new Response("Upgrade required", { status: 426 });
  },
  websocket: {
    open(ws) {
      const upstream = new WebSocket(`${DAEMON_ORIGIN.replace(/^http/, "ws")}${ws.data.path}`, {
        headers: { Origin: DAEMON_ORIGIN },
      });
      ws.data.upstream = upstream;
      upstream.onmessage = (event) => {
        if (typeof event.data === "string") ws.send(event.data);
      };
      upstream.onclose = () => ws.close();
      upstream.onerror = () => ws.close();
    },
    message(ws, message) {
      ws.data.upstream?.send(message);
    },
    close(ws) {
      ws.data.upstream?.close();
    },
  },
});

console.log(`WS relay listening on ${RELAY_PORT}, forwarding to ${DAEMON_ORIGIN}`);
