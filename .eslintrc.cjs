/**
 * rememo 공통 ESLint 설정 (classic config — ESLint 8).
 * TypeScript 규칙 + Prettier와의 포맷 충돌 제거(eslint-config-prettier).
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // 반드시 마지막: 포맷 관련 규칙 비활성화(Prettier가 담당)
  ],
  rules: {
    // Electron main/preload은 console 로깅을 정식으로 사용한다.
    'no-console': 'off',
    // 미완성 코드 조기 발견용: 미사용 변수는 경고, _ 접두사는 허용.
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // any는 금지하지 않되 눈에 띄게 경고(점진적 타입 강화).
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'release',
    'build',
    '**/*.config.ts',
    '**/*.config.js',
    '.eslintrc.cjs',
    'check-db.js',
    'test-regex.js',
  ],
};
