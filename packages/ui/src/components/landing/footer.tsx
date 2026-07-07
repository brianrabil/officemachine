export interface FooterLinkItem {
  readonly label: string;
  readonly href?: string;
}

export interface FooterColumn {
  readonly heading: string;
  readonly items: readonly FooterLinkItem[];
}

export interface FooterProps {
  readonly brand: string;
  readonly tagline: string;
  readonly poweredByHref?: string;
  readonly columns: readonly FooterColumn[];
}

export function Footer({ brand, tagline, poweredByHref, columns }: FooterProps) {
  return (
    <footer>
      <div className="mx-auto max-w-[1320px] border-t border-border px-6 py-14 md:py-18">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex h-full flex-col">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {brand}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">{tagline}</div>
            {poweredByHref ? (
              <a
                href={poweredByHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto pt-6 block text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  viewBox="0 0 76 65"
                  className="h-4"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
              </a>
            ) : null}
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                {column.heading}
              </div>
              <div
                className={
                  column.items.every((item) => !item.href)
                    ? "mt-4 flex flex-col gap-2 font-mono text-sm text-muted-foreground"
                    : "mt-4 flex flex-col gap-2"
                }
              >
                {column.items.map((item) =>
                  item.href ? (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span key={item.label}>{item.label}</span>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
