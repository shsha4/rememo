# rememo 빌드 가이드

## macOS 배포 패키지 만들기

macOS(Apple Silicon)용 DMG를 만드는 방법입니다. **네이티브 모듈(better-sqlite3)이 있어 macOS 패키지는 반드시 macOS에서 빌드해야 합니다.**

### 사전 준비

```bash
# 저장소 루트에서
npm install
```

### 개발 모드로 실행

```bash
# 저장소 루트에서 — Vite + Electron 앱이 함께 뜹니다
npm run dev
```

> `npm run electron:dev`는 Electron을 이중으로 실행해 충돌할 수 있으니 개발 시에는 `npm run dev`를 사용하세요.

### DMG 빌드

```bash
cd apps/desktop

# Apple Silicon(arm64)용 DMG (서명 없음)
npm run build:mac

# Intel(x64)용
npm run build:mac-x64

# Universal (arm64 + x64 겸용)
npm run build:mac-universal
```

빌드 결과는 `apps/desktop/release/`에 생성됩니다:

- `rememo-0.1.0-mac-arm64.dmg` — Apple Silicon용 설치 이미지 (약 126MB)
- `mac-arm64/rememo.app` — 압축 해제된 앱 번들

### 배포 및 실행 (서명 없음)

코드 서명을 하지 않았으므로 앱을 **처음 실행할 때** Gatekeeper 경고가 뜹니다. 받는 사람은:

1. `rememo.app`을 `응용 프로그램` 폴더로 드래그
2. 앱을 **우클릭 → 열기** → 대화상자에서 다시 **열기** (최초 1회만)
   - 또는 `설정 → 개인정보 보호 및 보안`에서 "확인 없이 열기" 허용
3. 이후에는 일반 실행 가능

> 정식 배포(경고 없이 실행)를 원하면 Apple Developer 계정($99/년)으로 코드 서명 + 공증(notarization)이 필요합니다.

### 기술 참고 (버전 요구사항)

- **Electron 43** — macOS Sequoia(15.x)에서 실행하려면 필수. Electron 28은 Sequoia에서 앱 시작 즉시 SIGTRAP 크래시합니다.
- **better-sqlite3 12** — Electron 43의 V8 API와 호환되는 버전. 11.x는 컴파일되지 않습니다.
- 네이티브 모듈은 Electron 버전에 맞춰 리빌드해야 합니다:
  ```bash
  # 저장소 루트에서
  ./node_modules/.bin/electron-rebuild -f -w better-sqlite3
  ```

### 문제 해결 (macOS)

**컴파일 시 `'climits' file not found` 등 C++ 표준 헤더 오류**

Xcode Command Line Tools의 libc++ 헤더가 손상된 경우입니다. 근본 해결은 CLT 재설치:

```bash
sudo rm -rf /Library/Developer/CommandLineTools
sudo xcode-select --install
```

재설치 후에도 툴체인 헤더가 불완전하면, 빌드 명령 앞에 정상 SDK의 헤더 경로를 주입해 우회할 수 있습니다:

```bash
export CPLUS_INCLUDE_PATH="$(xcrun --show-sdk-path)/usr/include/c++/v1"
npm install
./node_modules/.bin/electron-rebuild -f -w better-sqlite3
npm run build:mac
```

**앱 실행 시 `NODE_MODULE_VERSION` 불일치 오류**

better-sqlite3가 Electron ABI가 아닌 시스템 Node ABI로 빌드된 경우입니다. 위의 `electron-rebuild`를 실행하세요.

---

## Windows 배포 패키지 만들기

친구들에게 배포할 수 있는 Windows 패키지를 만드는 방법입니다.

### 빌드 명령어

```bash
# apps/desktop 디렉토리로 이동
cd apps/desktop

# Windows 포터블 버전 빌드 (권장)
npm run build && npx electron-builder --win --x64 --dir
cd release
powershell -Command "Compress-Archive -Path 'win-unpacked\*' -DestinationPath 'rememo-0.1.0-windows-portable.zip' -Force"

# 또는 설치 패키지 빌드 (관리자 권한 필요)
npm run build:win
```

### 빌드 결과

빌드가 완료되면 `apps/desktop/release` 디렉토리에 다음 파일이 생성됩니다:

- `rememo-0.1.0-windows-portable.zip` - Windows 포터블 버전 (권장)
- `win-unpacked/` - 압축 해제된 실행 파일들
- `rememo-0.1.0-Setup.exe` - Windows 설치 프로그램 (관리자 권한 필요)

### 배포하기

#### 포터블 버전 (권장)
1. `release` 폴더의 `rememo-0.1.0-windows-portable.zip` 파일을 친구들에게 공유
2. 친구들은 ZIP 파일을 압축 해제 후 `rememo.exe`를 실행
3. 설치 불필요 - 원하는 폴더에 압축만 풀면 됨
4. Node.js나 다른 개발 도구 설치 불필요

#### 설치 프로그램 버전
1. 설치 프로그램을 만들려면 **관리자 권한**으로 PowerShell을 실행해야 합니다
2. 또는 Windows 개발자 모드 활성화: 설정 > 업데이트 및 보안 > 개발자용 > 개발자 모드
3. `release` 폴더의 `rememo-0.1.0-Setup.exe` 파일을 친구들에게 공유

### 포터블 버전 특징

- ✅ 설치 불필요 - ZIP 압축 해제만으로 사용 가능
- ✅ 관리자 권한 불필요
- ✅ 원하는 위치에 배치 가능
- ✅ 바로가기 수동 생성 가능
- ✅ Node.js 및 모든 의존성 포함
- ✅ USB 드라이브에서도 실행 가능

### 주의사항

- 빌드는 Windows 환경에서 실행해야 합니다
- 첫 빌드는 의존성 다운로드로 시간이 걸릴 수 있습니다 (5-10분)
- 포터블 ZIP 크기는 약 120MB, 압축 해제 시 약 230MB입니다
- 설치 프로그램 빌드 시 symlink 권한 오류가 발생하면 포터블 버전을 사용하세요

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
