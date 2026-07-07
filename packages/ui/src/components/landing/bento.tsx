import type { ReactNode } from "react";

export interface BentoItem {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface BentoProps {
  readonly heading: ReactNode;
  readonly description: ReactNode;
  readonly command: string;
  readonly items: readonly BentoItem[];
}

function mark(index: number) {
  if (index === 0) {
    return (
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="h-px w-4 bg-foreground/30" />
        <span className="h-px w-6 bg-foreground/30" />
        <span className="h-px w-3 bg-foreground/30" />
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="grid grid-cols-3 gap-1" aria-hidden="true">
        <span className="size-2 border border-foreground/25" />
        <span className="size-2 border border-foreground/25" />
        <span className="size-2 border border-foreground/25" />
        <span className="size-2 border border-foreground/25" />
        <span className="size-2 border border-foreground/25" />
        <span className="size-2 border border-foreground/25" />
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="flex flex-col gap-1" aria-hidden="true">
        <span className="h-1 w-8 border border-foreground/25" />
        <span className="h-1 w-6 border border-foreground/25" />
        <span className="h-1 w-4 border border-foreground/25" />
      </div>
    );
  }

  return (
    <div className="relative h-6 w-8" aria-hidden="true">
      <span className="absolute top-0 left-0 size-2 border border-foreground/25" />
      <span className="absolute top-0 right-0 size-2 border border-foreground/25" />
      <span className="absolute bottom-0 left-1/2 size-2 -translate-x-1/2 border border-foreground/25" />
    </div>
  );
}

export function Bento({ heading, description, command, items }: BentoProps) {
  return (
    <section>
      <div className="mx-auto max-w-[1320px] border-t border-border px-6 py-20 md:py-28">
        <div className="grid gap-10 border-b border-border pb-12 md:grid-cols-[1.2fr_0.8fr] md:pb-14">
          <div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-5xl leading-[1.05]">
              {heading}
            </h2>
          </div>
          <div className="md:pt-2">
            <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
            <div className="mt-6">
              <div className="inline-flex items-center gap-3 rounded-lg border border-border bg-muted px-4 py-2 font-mono text-sm text-foreground/60">
                <span className="text-muted-foreground">$</span>
                <span>{command}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <article
              key={item.id}
              className={`flex h-full flex-col border-b border-border py-8 md:px-6 md:py-9 ${
                index % 2 === 1 ? "md:border-l md:border-l-border" : ""
              } ${index >= 2 ? "md:border-b-0" : ""} ${
                index > 0
                  ? "lg:border-l lg:border-l-border"
                  : "lg:border-l-0"
              } lg:border-b-0`}
            >
              <div className="font-mono text-[11px] text-muted-foreground">
                {item.id}
              </div>
              <div className="mt-7 flex h-10 items-center">{mark(index)}</div>
              <h3 className="mt-7 text-lg font-semibold tracking-tight text-foreground text-balance">
                {item.title}
              </h3>
              <p className="mt-4 flex-1 text-pretty text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
