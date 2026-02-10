import React from 'react';
import { Box, Text } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { theme } from './theme.js';

type AppShellProps = {
  title: string;
  children: React.ReactNode;
  statusLeft: string;
  statusRight?: string;
  hint?: string;
};

export function AppShell({ title, children, statusLeft, statusRight, hint }: AppShellProps): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color={theme.colors.brand} bold>
          snd
        </Text>
        <Text> </Text>
        <Text color={theme.colors.text}>{title}</Text>
      </Box>

      <Box flexDirection="column">{children}</Box>

      {hint ? (
        <Box marginTop={1}>
          <Text color={theme.colors.muted}>{hint}</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <StatusBar left={statusLeft} right={statusRight} />
      </Box>
    </Box>
  );
}
