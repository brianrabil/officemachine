import { Box } from "ink";
import type { ReactNode } from "react";

export interface ChatThreadProps {
  maxHeight?: number;
  autoScroll?: boolean;
  children?: ReactNode;
}

export const ChatThread = ({ maxHeight, autoScroll = true, children }: ChatThreadProps) => {
  void autoScroll;

  if (maxHeight) {
    return (
      <Box flexDirection="column" height={maxHeight} overflow="hidden">
        {children}
      </Box>
    );
  }

  return <Box flexDirection="column">{children}</Box>;
};
