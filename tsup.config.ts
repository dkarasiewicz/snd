import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  outDir: 'dist',
});
