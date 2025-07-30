import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        popup: resolve(__dirname, 'src/popup/popup.ts'),
      },
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        extend: true,
      },
    },
    target: 'es2020',
    minify: false,
  },
});