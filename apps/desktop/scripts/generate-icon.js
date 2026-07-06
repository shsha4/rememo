const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [256, 512, 1024];
const buildDir = path.join(__dirname, '..', 'build');
const svgPath = path.join(buildDir, 'icon.svg');

async function generateIcons() {
  if (!fs.existsSync(svgPath)) {
    console.error('SVG file not found:', svgPath);
    return;
  }

  const svgBuffer = fs.readFileSync(svgPath);

  for (const size of sizes) {
    const outputPath = path.join(buildDir, `icon-${size}.png`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${size}x${size} icon`);
  }

  // Use 1024x1024 as the main icon (electron-builder requires >=512px for macOS .icns)
  const mainIconPath = path.join(buildDir, 'icon.png');
  fs.copyFileSync(path.join(buildDir, 'icon-1024.png'), mainIconPath);
  console.log(`✓ Generated main icon.png (1024x1024)`);

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
