import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5307, strictPort: true },
  preview: { port: 4307, strictPort: true },
});
