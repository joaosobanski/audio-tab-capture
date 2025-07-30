import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content.ts'),
      name: 'content',
      fileName: 'content',
      formats: ['iife'],
    },
    target: 'es2020',
    minify: false,
  },
});