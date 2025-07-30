import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/server.ts'),
      name: 'AudioTabCaptureBackend',
      fileName: 'server',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'express',
        'ws',
        'cors',
        'helmet',
        'morgan',
        'multer',
        'uuid',
        'fs',
        'path',
        'http',
        'url',
      ],
    },
    target: 'node18',
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared/src'),
    },
  },
});