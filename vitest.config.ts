import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // 소스 기준으로 core를 해석(빌드 선행 불필요) — vite/tsconfig와 동일 정책.
      '@memograph/core': path.resolve(__dirname, './packages/core/src'),
    },
  },
  test: {
    globals: true,
    // 기본은 node 환경(도메인/파서/서비스 로직).
    // 렌더러 컴포넌트 테스트는 파일 상단에 `// @vitest-environment jsdom` 주석으로 개별 전환한다.
    environment: 'node',
    include: ['packages/**/src/**/*.{test,spec}.{ts,tsx}', 'apps/**/src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/release/**'],
  },
});
