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
          resolve: {
            alias: {
              '@memograph/core': path.resolve(__dirname, '../../packages/core/src'),
            },
          },
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
          resolve: {
            alias: {
              '@memograph/core': path.resolve(__dirname, '../../packages/core/src'),
            },
          },
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
        chokidar: { type: 'esm' },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer/src'),
      // renderer도 core를 소스에서 해석한다(main/preload와 동일). dist(CJS)로 해석하면 rollup이
      // __exportStar 재export를 통한 런타임 값(함수/클래스)의 named export를 정적 추적하지 못해
      // 빌드가 깨진다(타입만 import할 땐 값이 erase돼 드러나지 않았음).
      '@memograph/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist/renderer',
  },
});
