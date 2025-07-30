import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    lib: {
      entry: 'src/server.ts',
      formats: ['es'],
      fileName: 'server',
    },
    rollupOptions: {
      external: [
        'express', 
        'cors', 
        'helmet', 
        'ws', 
        'uuid', 
        'multer', 
        'fs', 
        'path', 
        'crypto',
        'http',
        'https',
        'url',
        'os',
        'util'
      ],
    },
    minify: false,
    sourcemap: true,
    ssr: true,
  },
  ssr: {
    noExternal: ['@audio-tab-capture/shared'],
  },
});