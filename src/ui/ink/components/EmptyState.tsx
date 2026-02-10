import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

type EmptyStateProps = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: EmptyStateProps): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color={theme.colors.warning}>{title}</Text>
      {subtitle ? <Text color={theme.colors.muted}>{subtitle}</Text> : null}
    </Box>
  );
}
