import { defineConfig } from 'tsup';

// Minimum required Node.js version: 22.20.0 (LTS)
// Keep this in sync with README and package.json requirements
export default defineConfig({
  entry: ['src/main.ts', 'src/preload.ts'],
  outDir: 'dist',
  target: 'node22', // Node.js 22.20.0
  format: 'cjs',
  platform: 'node',
  external: ['electron'],
  sourcemap: true,
  clean: true,
});
