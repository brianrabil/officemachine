"use client";

import { HotkeysProvider as TanStackHotkeysProvider } from "@tanstack/react-hotkeys";

export function HotkeysProvider({
  children,
  ...props
}: React.ComponentProps<typeof TanStackHotkeysProvider>) {
  return <TanStackHotkeysProvider {...props}>{children}</TanStackHotkeysProvider>;
}
