"use client";

import { useState } from "react";
import { useHotkey, useHotkeyRegistrations, formatForDisplay } from "@tanstack/react-hotkeys";
import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const { hotkeys } = useHotkeyRegistrations();

  // The type-safe `Hotkey` strings deliberately exclude Shift+punctuation
  // combos (layout-dependent across keyboards), so "?" is registered via
  // the RawHotkey object form instead, matching the literal event.key value
  // a US-layout Shift+/ press produces.
  useHotkey(
    { key: "?" },
    () => setOpen(true),
    { meta: { name: "Shortcuts help", description: "Show this list of keyboard shortcuts" } },
  );

  const named = hotkeys.filter((reg) => reg.options.meta?.name);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Keyboard shortcuts"
          >
            <Keyboard className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Keyboard shortcuts (?)</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1.5">
            {named.map((reg) => (
              <li key={reg.id} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  {reg.options.meta?.description ?? reg.options.meta?.name}
                </span>
                <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {formatForDisplay(reg.hotkey)}
                </kbd>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
