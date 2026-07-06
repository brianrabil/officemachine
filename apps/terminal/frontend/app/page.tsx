"use client";

import { useCallback, useRef, useState } from "react";
import { Terminal, useTerminal } from "@wterm/react";
import { BashShell } from "@wterm/just-bash";
import "@wterm/react/css";
import { SquareTerminalIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Theme {
  value: string;
  theme: string | undefined;
}

const THEMES: Theme[] = [
  { value: "Default", theme: undefined },
  { value: "Solarized Dark", theme: "solarized-dark" },
  { value: "Monokai", theme: "monokai" },
  { value: "Light", theme: "light" },
];

const INITIAL_COLS = 80;
const INITIAL_ROWS = 24;

const INITIAL_FILES: Record<string, string> = {
  "/home/user/README.md":
    "# wterm\n\nA terminal emulator for the web.\nRenders to the DOM — native text selection, copy/paste, and accessibility come for free.\nThe core is written in Zig and compiled to WASM.\n\nUses just-bash for shell execution.\n",
  "/home/user/package.json":
    '{\n  "name": "wterm",\n  "version": "0.1.0",\n  "description": "Terminal emulator for the web"\n}\n',
  "/home/user/src/main.zig":
    'const std = @import("std");\n\npub fn main() void {\n    std.debug.print("Hello from Zig!\\n", .{});\n}\n',
  "/home/user/examples/hello.sh":
    '#!/bin/bash\necho "Hello from wterm!"\necho "Date: $(date)"\necho "Shell: $SHELL"\n',
};

export default function Home() {
  const { ref, write } = useTerminal();
  const [themeLabel, setThemeLabel] = useState("Default");
  const [title, setTitle] = useState("wterm");
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ cols: INITIAL_COLS, rows: INITIAL_ROWS });
  const theme = THEMES.find((t) => t.value === themeLabel)?.theme;
  const shellRef = useRef<BashShell | null>(null);

  const handleReady = useCallback(() => {
    setReady(true);
    if (shellRef.current) return;
    const shell = new BashShell({
      files: INITIAL_FILES,
      greeting: [
        "wterm — terminal emulator for the web",
        "Powered by just-bash · running entirely in the browser",
        "",
        "Type help for commands, or try: ls, cat README.md, bash examples/hello.sh",
        "",
      ],
    });
    shellRef.current = shell;
    shell.attach(write);
  }, [write]);

  const handleData = useCallback((data: string) => {
    shellRef.current?.handleInput(data);
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    setSize({ cols, rows });
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <SquareTerminalIcon className="size-4" />
          </div>
          <span className="text-sm font-medium text-foreground">{title}</span>
          <Badge variant="secondary" className="font-mono font-normal text-muted-foreground">
            just-bash
          </Badge>
        </div>
        <div className="flex items-center gap-2.5">
          <Label htmlFor="theme" className="text-sm text-muted-foreground">
            Theme
          </Label>
          <Select value={themeLabel} onValueChange={(v) => v && setThemeLabel(v)}>
            <SelectTrigger id="theme" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center overflow-hidden p-6">
        <div className="flex w-full max-w-[900px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
            <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          </div>
          <Terminal
            ref={ref}
            cols={INITIAL_COLS}
            rows={INITIAL_ROWS}
            wasmUrl="/wterm.wasm"
            theme={theme}
            onData={handleData}
            onTitle={setTitle}
            onReady={handleReady}
            onResize={handleResize}
            className="p-3"
          />
        </div>
      </main>

      <footer className="flex items-center justify-between gap-4 border-t border-border px-4 py-2 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", ready ? "bg-success" : "bg-muted-foreground/40")} />
          {ready ? "Ready" : "Booting shell…"}
        </div>
        <div className="flex items-center gap-3">
          <span>
            {size.cols} × {size.rows}
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span>WASM · Zig</span>
        </div>
      </footer>
    </div>
  );
}
