import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Library build. The demo site builds via vite.demo.config.ts; `vite` (dev)
// serves the demo from index.html regardless of build.lib.
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/lib/index.ts'),
        noop: resolve(__dirname, 'src/lib/noop.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        format === 'es' ? `${entryName}.js` : `${entryName}.cjs`,
    },
  },
  test: {
    environment: 'jsdom',
  },
});
