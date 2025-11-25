import { defineConfig } from 'tsup';

// Build configuration for Synthesis Desktop
// - Builds the Electron main process and preload script
// - Outputs CommonJS bundles compatible with Electron's main/preload loading
export default defineConfig({
  entry: ['src/main.ts', 'src/preload.ts'],
  outDir: 'dist',
  format: ['cjs'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  external: ['electron'],
});
