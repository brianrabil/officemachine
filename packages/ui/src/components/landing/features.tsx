"use client";

import type { ReactNode } from "react";

import { Stage } from "./stage";
import { Window } from "./window";

export type PanelRowTone = "cmd" | "code" | "dim";

export interface PanelRow {
  readonly tone: PanelRowTone;
  readonly text: string;
}

export interface PanelProps {
  readonly rows: readonly PanelRow[];
}

function rowstyle(tone: PanelRowTone): string {
  switch (tone) {
    case "cmd": {
      return "text-foreground/75";
    }
    case "dim": {
      return "text-muted-foreground/70";
    }
    default: {
      return "text-foreground/60";
    }
  }
}

export function Panel({ rows }: PanelProps) {
  return (
    <div className="flex h-[280px] flex-col overflow-hidden bg-popover">
      <div className="flex-1 overflow-x-auto overflow-y-auto px-5 py-4 font-mono text-[12px] leading-[1.65] tabular-nums sm:text-[13px]">
        <div className="w-fit min-w-full whitespace-pre">
          {rows.map((entry, index) => (
            <div key={`${entry.text}-${index}`} className={rowstyle(entry.tone)}>
              {entry.text || "\u00A0"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface SpotlightItem {
  readonly id: string;
  readonly tone: "slate" | "ash" | "iron";
  readonly title: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly flip?: boolean;
  readonly window: ReactNode;
}

export interface FeaturesProps {
  readonly spotlights: readonly SpotlightItem[];
}

function Spotlight({ tone, title, description, bullets, flip, window }: Omit<SpotlightItem, "id">) {
  return (
    <div className="grid min-w-0 items-center gap-10 overflow-hidden md:grid-cols-2 md:gap-16">
      <div className={`min-w-0 ${flip ? "order-1 md:order-2" : "order-1 md:order-1"}`}>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        <ul className="mt-8 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-3 text-sm text-foreground/70">
              <span className="h-1 w-1 rounded-full bg-foreground/40" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className={`min-w-0 ${flip ? "order-2 md:order-1" : "order-2 md:order-2"}`}>
        <Stage tone={tone}>
          <div className="mx-auto w-full min-w-0 max-w-[1160px]">
            <Window title="" bar={false}>
              {window}
            </Window>
          </div>
        </Stage>
      </div>
    </div>
  );
}

export function Features({ spotlights }: FeaturesProps) {
  return (
    <section>
      <div className="mx-auto max-w-[1320px] overflow-hidden px-6 pt-20 pb-20 md:pt-28 md:pb-28">
        <div className="space-y-16 md:space-y-28">
          {spotlights.map((spotlight) => (
            <Spotlight key={spotlight.id} {...spotlight} />
          ))}
        </div>
      </div>
    </section>
  );
}
