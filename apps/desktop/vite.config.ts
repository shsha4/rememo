import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            lib: {
              entry: 'src/main/index.ts',
              formats: ['cjs'],
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3'],
            },
            commonjsOptions: {
              transformMixedEsModules: true,
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist/preload',
            lib: {
              entry: 'src/preload/index.ts',
              formats: ['cjs'],
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer({
      nodeIntegration: false,
      resolve: {
        'better-sqlite3': { type: 'cjs' },
        'chokidar': { type: 'esm' },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer/src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist/renderer',
  },
});
