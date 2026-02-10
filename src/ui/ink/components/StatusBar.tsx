import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

type StatusBarProps = {
  left: string;
  right?: string;
};

export function StatusBar({ left, right }: StatusBarProps): React.JSX.Element {
  const combined = right ? `${left} | ${right}` : left;

  return (
    <Box borderStyle="single" borderColor={theme.colors.muted} paddingX={1}>
      <Text color={theme.colors.muted} wrap="truncate-end">
        {combined}
      </Text>
    </Box>
  );
}
