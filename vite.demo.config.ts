import { defineConfig } from 'vite';

// Demo site build (the library itself builds via vite.config.ts).
export default defineConfig({
  build: {
    outDir: 'dist-demo',
  },
});
