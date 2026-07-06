"use client";

import * as React from "react";
import {
  Terminal as TerminalPrimitive,
  useTerminal,
  WebSocketTransport,
  type TerminalHandle,
  type TerminalProps as TerminalPrimitiveProps,
  type TerminalCore,
  type WebSocketTransportOptions,
} from "@wterm/react";
import { cn } from "@workspace/ui/lib/utils";

interface TerminalProps extends TerminalPrimitiveProps {
  autoResize?: boolean;
  cursorBlink?: boolean;
}

const Terminal = React.forwardRef<TerminalHandle, TerminalProps>(
  ({ className, autoResize = true, cursorBlink = true, ...props }, ref) => {
    return (
      <TerminalPrimitive
        ref={ref}
        data-slot="terminal"
        autoResize={autoResize}
        cursorBlink={cursorBlink}
        className={cn("size-full", className)}
        {...props}
      />
    );
  },
);
Terminal.displayName = "Terminal";

export { Terminal, useTerminal, WebSocketTransport };
export type { TerminalProps, TerminalHandle, TerminalCore, WebSocketTransportOptions };
