const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '../public');

const fullBleedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="pn-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#12345A" />
      <stop offset="55%" stop-color="#0A2540" />
      <stop offset="100%" stop-color="#06182C" />
    </linearGradient>
    <radialGradient id="pn-aura" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00E5F4" stop-opacity="0.4" />
      <stop offset="65%" stop-color="#007C8B" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#06182C" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="pn-rib-l" x1="104" y1="64" x2="232" y2="448" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00E5F4" />
      <stop offset="45%" stop-color="#008B9B" />
      <stop offset="100%" stop-color="#00E5F4" />
    </linearGradient>
    <linearGradient id="pn-rib-r" x1="272" y1="56" x2="416" y2="448" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00A8B8" />
      <stop offset="40%" stop-color="#00E5F4" />
      <stop offset="100%" stop-color="#007C8B" />
    </linearGradient>
    <linearGradient id="pn-fold" x1="136" y1="96" x2="376" y2="400" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06182C" />
      <stop offset="50%" stop-color="#0A2540" />
      <stop offset="100%" stop-color="#006A78" />
    </linearGradient>
    <radialGradient id="pn-star-core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="45%" stop-color="#A6FAFF" />
      <stop offset="100%" stop-color="#00E5F4" stop-opacity="0.2" />
    </radialGradient>
  </defs>

  <!-- Full bleed background for safe area maskable icon -->
  <rect width="512" height="512" fill="url(#pn-bg)" />
  <circle cx="256" cy="256" r="200" fill="url(#pn-aura)" />

  <!-- Centered Scaled PENORA Ribbon Emblem (safe 72% size) -->
  <g transform="translate(88, 88) scale(2.65625)">
    <!-- Left Sculptural Ribbon -->
    <path d="M62.5 16C45 30 27 47 27 67C27 83 40 98 60.5 110C48 97 41 82 43 65C45 48 53 32 62.5 16Z" fill="url(#pn-fold)" />
    <path d="M62.5 14C39 27 21 46 21 67C21 82 33 98 61.5 112C51 99 47 86 49 74C38 69 29 63 39 51C49 40 58 28 62.5 14Z" fill="url(#pn-rib-l)" />

    <!-- Right Sculptural Ribbon -->
    <path d="M65.5 16C83 30 101 47 101 67C101 83 88 98 67.5 110C80 97 87 82 85 65C83 48 75 32 65.5 16Z" fill="url(#pn-fold)" />
    <path d="M65.5 14C89 27 107 46 107 67C107 82 95 98 66.5 112C77 99 81 86 79 73C89 65 94 54 88 41C83 30 73 22 65.5 14Z" fill="url(#pn-rib-r)" />

    <!-- Elongated 4-Point Star -->
    <path d="M64 26C65.8 43 68.5 55.5 83 64C68.5 72.5 65.8 85 64 102C62.2 85 59.5 72.5 45 64C59.5 55.5 62.2 43 64 26Z" fill="#00B8C8" />
    <path d="M64 36C65 48 67 57 76 64C67 71 65 80 64 92C63 80 61 71 52 64C61 57 63 48 64 36Z" fill="url(#pn-star-core)" />
  </g>
</svg>`;

async function run() {
  const buf = Buffer.from(fullBleedSvg);
  const faviconSvg = fs.readFileSync(path.join(publicDir, 'favicon.svg'));

  await sharp(faviconSvg).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ icon-192.png');
  await sharp(faviconSvg).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ icon-512.png');
  await sharp(buf).resize(512, 512).png().toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('✓ icon-maskable-512.png');
  await sharp(buf).resize(192, 192).png().toFile(path.join(publicDir, 'icon-maskable-192.png'));
  console.log('✓ icon-maskable-192.png');
  await sharp(buf).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
