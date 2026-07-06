"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal, useTerminal } from "@wterm/react";
import type { WTerm } from "@wterm/dom";
import type { TerminalCore } from "@wterm/core";
import { SquareTerminalIcon } from "lucide-react";
import { GhosttyCore } from "@wterm/ghostty";
import "@wterm/react/css";

export default function Home() {
  const [bridge, setBridge] = useState("checking...");

  useEffect(() => {
    setBridge((window as any).zero ? "available" : "not enabled");
  }, []);

  const [debugEnabled] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug"),
  );
  const [core, setCore] = useState<TerminalCore | null>(null);
  const { ref, write } = useTerminal();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    GhosttyCore.load({ wasmPath: "/ghostty-vt.wasm" }).then(setCore);
  }, []);

  const handleReady = useCallback(
    (wt: WTerm) => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${window.location.host}/api/terminal`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(`\x1b[RESIZE:${wt.cols};${wt.rows}]`);
      };

      ws.onmessage = (event: MessageEvent) => {
        write(event.data as string);
      };

      ws.onclose = () => {
        write("\r\n\x1b[90m[session ended]\x1b[0m\r\n");
        wsRef.current = null;
      };
    },
    [write],
  );

  const handleData = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(`\x1b[RESIZE:${cols};${rows}]`);
    }
  }, []);

  if (!core) return null;

  return (
    <div className="flex size-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <SquareTerminalIcon className="size-4" />
          </div>
          <span className="text-sm font-medium text-foreground">OfficeMachine Terminal</span>
        </div>
        <div className="card">
          <span>Native bridge</span>
          <strong>{bridge}</strong>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <Terminal
          ref={ref}
          cols={80}
          rows={24}
          autoResize
          debug={debugEnabled}
          core={core}
          onReady={handleReady}
          onData={handleData}
          onResize={handleResize}
          className="flex-1"
          style={{ borderRadius: 0, boxShadow: "none", padding: 0 }}
        />
      </main>
      <footer className="flex items-center justify-between gap-4 border-t border-border px-4 py-2 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>WTERM · Ghostty</span>
        </div>
      </footer>
    </div>
  );
}
