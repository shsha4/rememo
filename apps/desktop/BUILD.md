# rememo 빌드 가이드

## Windows 설치 패키지 만들기

친구들에게 배포할 수 있는 Windows 설치 패키지를 만드는 방법입니다.

### 빌드 명령어

```bash
# apps/desktop 디렉토리로 이동
cd apps/desktop

# Windows 64비트 설치 패키지 빌드
npm run build:win

# Windows 32비트 설치 패키지 빌드 (옵션)
npm run build:win32

# 64비트 + 32비트 모두 빌드 (옵션)
npm run build:win-all
```

### 빌드 결과

빌드가 완료되면 `apps/desktop/release` 디렉토리에 다음 파일이 생성됩니다:

- `rememo-0.1.0-Setup.exe` - Windows 설치 프로그램

### 배포하기

1. `release` 폴더의 `rememo-0.1.0-Setup.exe` 파일을 친구들에게 공유
2. 친구들은 해당 파일을 실행하기만 하면 됩니다
3. Node.js나 다른 개발 도구 설치 불필요 - 모든 것이 설치 파일에 포함됨

### 설치 프로그램 특징

- ✅ 설치 위치 선택 가능
- ✅ 바탕화면 바로가기 자동 생성
- ✅ 시작 메뉴 바로가기 자동 생성
- ✅ 제거 프로그램 포함
- ✅ Node.js 및 모든 의존성 포함

### 주의사항

- 빌드는 Windows 환경에서 실행해야 합니다
- 첫 빌드는 의존성 다운로드로 시간이 걸릴 수 있습니다 (5-10분)
- 빌드 완료 후 `release` 폴더 크기는 약 100-200MB입니다

### 버전 업데이트

새 버전을 배포하려면:

1. `package.json`의 `version` 값 수정 (예: "0.1.0" -> "0.2.0")
2. `npm run build:win` 실행
3. 새로운 버전의 설치 파일 배포

### 앱 아이콘 추가 (선택사항)

커스텀 아이콘을 추가하려면:

1. 256x256 PNG 이미지 준비
2. PNG를 ICO 형식으로 변환 (온라인 도구 사용: https://convertio.co/kr/png-ico/)
3. `apps/desktop/build/icon.ico`로 저장
4. `package.json`의 `build.win` 섹션에 다음 추가:
   ```json
   "icon": "build/icon.ico"
   ```

## 문제 해결

### 빌드 실패 시

```bash
# 캐시 및 빌드 결과 삭제 후 재시도
cd apps/desktop
rm -rf dist release node_modules/.cache
npm run build:win
```

### better-sqlite3 관련 오류

better-sqlite3는 네이티브 모듈이므로 자동으로 리빌드됩니다.
오류가 발생하면:

```bash
npm install --save-dev @electron/rebuild
npx electron-rebuild
```
