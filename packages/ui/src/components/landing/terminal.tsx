"use client";

import { useMemo, useState } from "react";

export type TerminalLineTone = "input" | "plain" | "dim" | "ok" | "muted";

export interface TerminalLine {
  readonly tone: TerminalLineTone;
  readonly text: string;
}

export interface TerminalScene {
  readonly name: string;
  readonly data: readonly TerminalLine[];
}

export interface TerminalProps {
  readonly scenes: readonly TerminalScene[];
}

function style(tone: TerminalLineTone): string {
  switch (tone) {
    case "input": {
      return "text-foreground/80";
    }
    case "dim": {
      return "text-muted-foreground/70";
    }
    case "ok": {
      return "text-foreground/60";
    }
    case "muted": {
      return "text-muted-foreground";
    }
    default: {
      return "text-foreground/65";
    }
  }
}

export function Terminal({ scenes }: TerminalProps) {
  const [slot, setslot] = useState(0);
  const active = scenes[slot];
  const rows = useMemo(() => active.data, [active]);

  return (
    <div className="group flex h-[460px] flex-col overflow-hidden transition-all duration-300 md:h-[520px]">
      <div className="flex items-center justify-between border-b border-border bg-black/15 px-3 py-2">
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground tabular-nums">
          <div>
            command <span className="text-foreground/70">ai {active.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="inline-flex size-1.5 rounded-full bg-foreground/50" />
          ready
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto overflow-y-auto bg-popover px-4 py-3 font-mono text-[12px] leading-[1.62] tabular-nums">
        <div className="w-fit min-w-full">
          {rows.map((row, index) => (
            <div
              key={`${active.name}-${index}`}
              className={`${style(row.tone)} whitespace-nowrap transition-colors duration-150`}
            >
              {row.text || "\u00A0"}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border bg-black/15 px-2 py-1.5">
        <div className="terminal-scroll flex items-center gap-1 overflow-x-auto font-mono text-[11px] text-muted-foreground">
          {scenes.map((scene, index) => {
            const current = index === slot;
            return (
              <button
                key={scene.name}
                type="button"
                onClick={() => setslot(index)}
                className={`shrink-0 rounded-sm border px-2.5 py-1 transition-colors duration-150 ${
                  current
                    ? "border-border bg-muted text-foreground/85"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground/65"
                }`}
                aria-label={`open ${scene.name}`}
              >
                {current ? `*${scene.name}` : scene.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
