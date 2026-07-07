"use client";

import type { ReactNode } from "react";

export interface HeroProps {
  readonly headline: ReactNode;
  readonly description: ReactNode;
  readonly command: string;
  readonly children?: ReactNode;
}

export function Hero({ headline, description, command, children }: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-32 pb-0 md:pt-44 md:pb-0">
      <div className="mx-auto max-w-[1320px] px-6">
        <div className="max-w-[740px]">
          <h1
            className="landing-fade-up text-5xl font-semibold tracking-tighter text-foreground sm:text-6xl md:text-7xl leading-[1.03]"
            style={{ animationDelay: "30ms" }}
          >
            {headline}
          </h1>
          <p
            className="landing-fade-up mt-5 text-base text-muted-foreground leading-relaxed"
            style={{ animationDelay: "90ms" }}
          >
            {description}
          </p>
        </div>

        <div
          className="landing-fade-up mt-8 flex items-center gap-4"
          style={{ animationDelay: "150ms" }}
        >
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-5 py-3 font-mono text-sm text-foreground/80">
            <span className="text-muted-foreground">$</span>
            <span>{command}</span>
          </div>
        </div>
      </div>

      {children ? (
        <div className="mx-auto mt-16 max-w-[1320px] px-6 md:mt-20">
          <div className="landing-fade-up" style={{ animationDelay: "240ms" }}>
            {children}
          </div>
        </div>
      ) : null}
    </section>
  );
}
