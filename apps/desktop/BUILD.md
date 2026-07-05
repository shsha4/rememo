# rememo 빌드 가이드

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
