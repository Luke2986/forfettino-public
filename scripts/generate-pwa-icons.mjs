/**
 * Generate PWA icons and iOS splash screens from public/favicon.svg
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 *
 * Produces:
 *   public/pwa-192x192.png
 *   public/pwa-512x512.png
 *   public/maskable-icon-512x512.png  (teal background + padded logo)
 *   public/apple-touch-icon.png       (180x180)
 *   public/splash/splash-WxH.png      (iOS splash screens)
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SVG_PATH = resolve(ROOT, 'public/favicon.svg');
const OUT_DIR = resolve(ROOT, 'public');
const SPLASH_DIR = resolve(OUT_DIR, 'splash');

// Read SVG and strip the DTD declaration that can trip up some parsers
let svg = readFileSync(SVG_PATH, 'utf-8');
svg = svg.replace(/<!DOCTYPE[^>]*>/i, '');

async function generateIcon(size, outName) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(resolve(OUT_DIR, outName));
  console.log(`✓ ${outName} (${size}x${size})`);
}

async function generateMaskable(size, outName) {
  // Maskable icons need a safe zone (~20% padding on each side)
  // So the logo occupies ~60% of the canvas, centered on teal background
  const logoSize = Math.round(size * 0.6);
  const logoBuffer = await sharp(Buffer.from(svg))
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 13, g: 148, b: 136, alpha: 1 }, // #0d9488 teal-600
    },
  })
    .composite([{ input: logoBuffer, gravity: 'centre' }])
    .png()
    .toFile(resolve(OUT_DIR, outName));
  console.log(`✓ ${outName} (${size}x${size}, maskable)`);
}

// iOS splash screen sizes: [width, height]
const SPLASH_SIZES = [
  [750, 1334],    // iPhone SE 3rd — 375x667 @2x
  [1170, 2532],   // iPhone 14, 15 — 390x844 @3x
  [1179, 2556],   // iPhone 14 Pro, 15 Pro, 16 — 393x852 @3x
  [1290, 2796],   // iPhone 14 Pro Max, 15 Pro Max, 16 Plus — 430x932 @3x
  [1284, 2778],   // iPhone 16 Pro Max — 428x926 @3x
];

async function generateSplash(width, height) {
  // Tint SVG to teal for splash
  const tealSvg = svg.replace(/fill="#000000"/g, 'fill="#0d9488"');
  // Logo ~20% of the shorter dimension
  const logoSize = Math.round(Math.min(width, height) * 0.2);
  const logoBuffer = await sharp(Buffer.from(tealSvg))
    .resize(logoSize, logoSize)
    .png()
    .toBuffer();

  const outName = `splash-${width}x${height}.png`;
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 241, g: 245, b: 249, alpha: 1 }, // #f1f5f9 slate-100
    },
  })
    .composite([{ input: logoBuffer, gravity: 'centre' }])
    .png()
    .toFile(resolve(SPLASH_DIR, outName));
  console.log(`✓ splash/${outName} (${width}x${height})`);
}

async function main() {
  console.log('Generating PWA icons from favicon.svg...\n');
  await generateIcon(192, 'pwa-192x192.png');
  await generateIcon(512, 'pwa-512x512.png');
  await generateIcon(180, 'apple-touch-icon.png');
  await generateMaskable(512, 'maskable-icon-512x512.png');

  console.log('\nGenerating iOS splash screens...\n');
  mkdirSync(SPLASH_DIR, { recursive: true });
  for (const [w, h] of SPLASH_SIZES) {
    await generateSplash(w, h);
  }
  console.log('\nDone! Icons and splash screens saved to public/');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
