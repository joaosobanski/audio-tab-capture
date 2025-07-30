import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
    rollupOptions: {
      input: './src/index.html'
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  }
});