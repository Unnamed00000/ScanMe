import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/ScanMe/',
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./index.source.html', import.meta.url)),
    },
  },
});
