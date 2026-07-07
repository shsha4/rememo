const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [256, 512, 1024];
// Windows .ico는 멀티해상도를 담는다(시작표시줄=32/48, 큰 아이콘=256).
// PNG 단일 파일을 win.icon으로 쓰면 시작표시줄이 기본 Electron 로고로 폴백하는 경우가 있어
// 반드시 멀티사이즈 .ico를 생성해 사용한다.
const icoSizes = [16, 32, 48, 64, 128, 256];
const buildDir = path.join(__dirname, '..', 'build');
const svgPath = path.join(buildDir, 'icon.svg');

// PNG 버퍼들을 ICO 컨테이너로 패킹한다(각 엔트리를 PNG로 저장 — Vista+ 지원).
// 외부 의존성 없이 sharp 출력만으로 .ico를 만들기 위한 최소 인코더.
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // image type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const data = [];

  entries.forEach(({ size, buffer }, i) => {
    const e = i * 16;
    // width/height 바이트는 0..255, 256은 0으로 표기한다.
    dir.writeUInt8(size >= 256 ? 0 : size, e + 0);
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1);
    dir.writeUInt8(0, e + 2); // 팔레트 색상 수(트루컬러=0)
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // color planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(buffer.length, e + 8); // 이미지 데이터 바이트 수
    dir.writeUInt32LE(offset, e + 12); // 파일 내 오프셋
    offset += buffer.length;
    data.push(buffer);
  });

  return Buffer.concat([header, dir, ...data]);
}

async function generateIcons() {
  if (!fs.existsSync(svgPath)) {
    console.error('SVG file not found:', svgPath);
    return;
  }

  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const outputPath = path.join(buildDir, `icon-${size}.png`);

    await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);

    console.log(`✓ Generated ${size}x${size} icon`);
  }

  // Use 1024x1024 as the main icon (electron-builder requires >=512px for macOS .icns)
  const mainIconPath = path.join(buildDir, 'icon.png');
  fs.copyFileSync(path.join(buildDir, 'icon-1024.png'), mainIconPath);
  console.log(`✓ Generated main icon.png (1024x1024)`);

  // 멀티사이즈 .ico 생성 (Windows 창/시작표시줄용).
  const icoEntries = [];
  for (const size of icoSizes) {
    const buffer = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    icoEntries.push({ size, buffer });
  }
  const icoPath = path.join(buildDir, 'icon.ico');
  fs.writeFileSync(icoPath, buildIco(icoEntries));
  console.log(`✓ Generated icon.ico (${icoSizes.join(', ')})`);

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
