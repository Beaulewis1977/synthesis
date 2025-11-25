import { defineConfig } from 'tsup';

export default defineConfig([
  // Main process
  {
    entry: ['src/main.ts'],
    outDir: 'dist',
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    clean: true,
    external: ['electron'],
    // Local imports are automatically bundled, noExternal not needed
  },
  // Preload script
  {
    entry: ['src/preload.ts'],
    outDir: 'dist',
    format: ['cjs'], // Preload must be CJS for Electron
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    external: ['electron'],
  },
]);
