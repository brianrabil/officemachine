import type { ReactNode } from "react";

export function Window({
  title,
  bar = true,
  children,
}: {
  readonly title: string;
  readonly bar?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-[0_40px_80px_rgba(0,0,0,0.55)] ring-1 ring-border/50">
      {bar ? (
        <div className="flex items-center justify-between border-b border-border bg-black/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-foreground/15" />
            <div className="h-3 w-3 rounded-full bg-foreground/15" />
            <div className="h-3 w-3 rounded-full bg-foreground/15" />
          </div>
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="w-10" />
        </div>
      ) : null}
      {children}
    </div>
  );
}
