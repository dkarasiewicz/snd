export const theme = {
  colors: {
    brand: 'cyan',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    muted: 'gray',
    accent: 'magenta',
    text: 'white',
  },
} as const;

export type Theme = typeof theme;
