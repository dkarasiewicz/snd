import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

type StatusBarProps = {
  left: string;
  right?: string;
};

export function StatusBar({ left, right }: StatusBarProps): React.JSX.Element {
  return (
    <Box borderStyle="single" borderColor={theme.colors.muted} paddingX={1} justifyContent="space-between">
      <Text color={theme.colors.muted}>{left}</Text>
      <Text color={theme.colors.muted}>{right ?? ''}</Text>
    </Box>
  );
}
