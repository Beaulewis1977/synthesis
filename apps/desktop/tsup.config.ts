import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/preload.ts'],
  outDir: 'dist',
  target: 'node22',
  format: 'cjs',
  platform: 'node',
  external: ['electron'],
  sourcemap: true,
  clean: true,
});
