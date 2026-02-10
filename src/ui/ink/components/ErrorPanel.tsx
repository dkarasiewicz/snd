import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

type ErrorPanelProps = {
  message: string;
};

export function ErrorPanel({ message }: ErrorPanelProps): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor={theme.colors.danger} flexDirection="column" paddingX={1}>
      <Text color={theme.colors.danger}>error</Text>
      <Text>{message}</Text>
    </Box>
  );
}
