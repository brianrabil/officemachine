import { Box, Text } from "ink";
import type { ReactNode } from "react";
import React from "react";

import { useTheme } from "@/components/ui/theme-provider";
import type { BigTextFont } from "./big-text";
import { BigText } from "./big-text";

export interface HelpScreenProps {
  title: string;
  font?: BigTextFont;
  titleColor?: string;
  tagline?: string;
  usage?: string;
  description?: string;
  columnGap?: number;
  flagWidth?: number;
  children: ReactNode;
}

export interface HelpScreenSectionProps {
  label: string;
  labelColor?: string;
  children: ReactNode;
}

export interface HelpScreenRowProps {
  flag: string;
  description: string;
  flagColor?: string;
  descriptionColor?: string;
}

const computeFlagWidth = (children: ReactNode): number => {
  let max = 0;
  React.Children.forEach(children, (section) => {
    if (React.isValidElement<{ children?: ReactNode }>(section)) {
      React.Children.forEach(section.props.children, (row) => {
        if (React.isValidElement<Partial<HelpScreenRowProps>>(row)) {
          const flag = row.props.flag;
          if (flag) {
            max = Math.max(max, flag.length);
          }
        }
      });
    }
  });
  return max;
};

const HelpScreenRoot = ({
  title,
  font = "block",
  titleColor,
  tagline,
  usage,
  description,
  columnGap = 4,
  flagWidth,
  children,
}: HelpScreenProps) => {
  const theme = useTheme();
  const resolvedColor = titleColor ?? theme.colors.primary;

  const resolvedFlagWidth = flagWidth ?? computeFlagWidth(children);

  const enrichedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement<{ _columnGap?: number; _flagWidth?: number }>(child)) {
      return React.cloneElement(child, {
        _columnGap: columnGap,
        _flagWidth: resolvedFlagWidth,
      });
    }
    return child;
  });

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box marginBottom={1}>
        <BigText font={font} color={resolvedColor}>
          {title}
        </BigText>
      </Box>

      {tagline && (
        <Box marginBottom={1}>
          <Text dimColor>{tagline}</Text>
        </Box>
      )}

      {usage && (
        <Box marginBottom={1}>
          <Text>
            <Text dimColor>{"Usage: "}</Text>
            {usage}
          </Text>
        </Box>
      )}

      {description && (
        <Box marginBottom={1}>
          <Text>{description}</Text>
        </Box>
      )}

      {enrichedChildren}
    </Box>
  );
};

const HelpScreenSection = ({
  label,
  labelColor,
  children,
  _flagWidth = 20,
  _columnGap = 4,
}: HelpScreenSectionProps & { _flagWidth?: number; _columnGap?: number }) => {
  const theme = useTheme();

  const enrichedRows = React.Children.map(children, (child) => {
    if (React.isValidElement<{ _columnGap?: number; _flagWidth?: number }>(child)) {
      return React.cloneElement(child, {
        _columnGap,
        _flagWidth,
      });
    }
    return child;
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={labelColor ?? theme.colors.foreground}>
        {label}
      </Text>
      {enrichedRows}
    </Box>
  );
};

const HelpScreenRow = ({
  flag,
  description,
  flagColor,
  descriptionColor,
  _flagWidth = 20,
  _columnGap = 4,
}: HelpScreenRowProps & { _flagWidth?: number; _columnGap?: number }) => {
  const theme = useTheme();
  const paddedFlag = flag.padEnd(_flagWidth + _columnGap);

  return (
    <Box flexDirection="row" paddingLeft={2}>
      <Text color={flagColor ?? theme.colors.mutedForeground}>{paddedFlag}</Text>
      <Text color={descriptionColor}>{description}</Text>
    </Box>
  );
};

export const HelpScreen = Object.assign(HelpScreenRoot, {
  Row: HelpScreenRow,
  Section: HelpScreenSection,
});
