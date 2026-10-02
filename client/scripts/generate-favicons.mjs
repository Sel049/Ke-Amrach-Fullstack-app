
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const svg = path.join(publicDir, 'favicon.svg');

if (!fs.existsSync(svg)) {
  console.error(`[error] missing source: ${svg}`);
  process.exit(1);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('[error] sharp is not installed. Run: npm i -D sharp');
  process.exit(1);
}

const rasters = [
  [512, 'icon-512x512.png'],
  [192, 'icon-192x192.png'],
  [180, 'apple-touch-icon.png']
];

// density only matters for the initial SVG rasterisation, not the resizes.
for (const [size, name] of rasters) {
  const info = await sharp(svg, { density: 600 }).resize(size, size).png().toFile(path.join(publicDir, name));
  console.log(`[ok] ${name} -> ${info.width}x${info.height}`);
}

// Pillow builds a classic multi-size ICO (BMP entries) that works in browsers,
// Windows Explorer and older clients alike.
const pythonCode = `
from PIL import Image
import sys, os
src = sys.argv[1]
dst = sys.argv[2]
im = Image.open(src).convert("RGBA")
im.save(dst, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
print("[ok] favicon.ico -> %d bytes" % os.path.getsize(dst))
`;

for (const bin of ['python', 'python3']) {
  try {
    execFileSync(bin, ['-c', pythonCode, path.join(publicDir, 'icon-512x512.png'), path.join(publicDir, 'favicon.ico')], { stdio: 'inherit' });
    console.log(`[ok] built favicon.ico with ${bin}`);
    process.exit(0);
  } catch {
    /* try the next interpreter */
  }
}

console.warn('[warn] Python/Pillow not found — favicon.ico was left unchanged.');
console.warn('       Modern browsers will use favicon.svg / favicon.png regardless.');
