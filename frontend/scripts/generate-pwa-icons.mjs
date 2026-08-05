// Rasterizes the PWA icon SVGs into the PNGs referenced by manifest.webmanifest
// and index.html. Requires sharp locally: `npm install sharp --no-save`, run
// from frontend/, then re-run this script whenever the source SVGs change.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(dir, '..', 'public');

const regular = readFileSync(path.join(dir, 'icon-source.svg'));
const maskable = readFileSync(path.join(dir, 'icon-source-maskable.svg'));

const targets = [
  { svg: regular, size: 192, out: 'pwa-icon-192.png' },
  { svg: regular, size: 512, out: 'pwa-icon-512.png' },
  { svg: maskable, size: 512, out: 'pwa-icon-maskable-512.png' },
  { svg: maskable, size: 180, out: 'apple-touch-icon.png' },
];

for (const { svg, size, out } of targets) {
  const dest = path.join(publicDir, out);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(dest);
  console.log(`wrote ${out} (${size}x${size})`);
}
