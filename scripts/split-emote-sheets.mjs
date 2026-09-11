// One-off tool used to produce frontend/src/assets/emotes/*.webp from the 2x2 sticker
// sheets in frontend/src/assets/original/.
// Usage: npm i sharp (anywhere, e.g. a temp folder) then
//   node scripts/split-emote-sheets.mjs <folder with the sheets> <output folder>
//
// Per quadrant: crop (inset only on the sides touching the sheet midlines so grid lines
// never leak in and nothing is cut on the outer edges), remove the OUTER background with
// a flood fill from the borders (inner whites such as eyes survive), trim to content, pad
// to a square, resize to 256 px, export lossy WebP with a lossless alpha channel and white
// under the transparent pixels (black under alpha bleeds dark fringes into the edges).
// Two background modes: 'white' (pure white with no saturation, so cream fur is kept) and
// 'black' (near black; the die-cut white border blends to grey at the edge and gets a
// luminance-based alpha).
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) throw new Error('usage: node split-emotes.mjs <sheets dir> <out dir>');
mkdirSync(OUT, { recursive: true });

// sheet file -> { bg, names: [top-left, top-right, bottom-left, bottom-right] }
const SHEETS = {
  'Gemini_Generated_Image_1oechq1oechq1oec.jpg': { bg: 'white', names: ['love', 'wink', 'tease', 'mindblown'] },
  'Gemini_Generated_Image_9jrdjw9jrdjw9jrd.jpg': { bg: 'white', names: ['shock', 'explode', 'oops', 'whoa'] },
  'Gemini_Generated_Image_dgwyycdgwyycdgwy.jpg': { bg: 'black', names: ['ez', 'done', 'clutch', 'gg'] },
  'Gemini_Generated_Image_spv5ofspv5ofspv5.jpg': { bg: 'black', names: ['lol', 'grumpy', 'thumbs', 'luck'] },
  'Gemini_Generated_Image_gu5fnngu5fnngu5f.jpg': { bg: 'black', names: ['point', 'shrug', 'ok', 'shh'] },
};

const SIZE = 256;
const MID_INSET = 0.02;

const MODES = {
  white: {
    isBg: (r, g, b) => r >= 240 && g >= 240 && b >= 240 && Math.max(r, g, b) - Math.min(r, g, b) <= 10,
    // JPEG ringing next to the background: light, unsaturated pixels fade out
    edgeAlpha: (r, g, b) => {
      const light = Math.min(r, g, b), sat = Math.max(r, g, b) - light;
      if (light < 205 || sat > 16) return null;
      return Math.round(((255 - light) / 50) * 255);
    },
  },
  black: {
    isBg: (r, g, b) => r <= 34 && g <= 34 && b <= 34,
    // grey blend between the black background and the white sticker border
    edgeAlpha: (r, g, b) => {
      const lum = Math.max(r, g, b);
      if (lum > 200) return null;
      return Math.min(255, Math.round((lum / 200) * 255));
    },
  },
};

async function processQuadrant(sheetPath, q, name, mode) {
  const meta = await sharp(sheetPath).metadata();
  const W = meta.width, H = meta.height;
  const qw = Math.floor(W / 2), qh = Math.floor(H / 2);
  const col = q % 2, row = Math.floor(q / 2);
  const ix = Math.floor(qw * MID_INSET), iy = Math.floor(qh * MID_INSET);
  const region = { left: col * qw + (col === 1 ? ix : 0), top: row * qh + (row === 1 ? iy : 0), width: qw - ix, height: qh - iy };

  const { data, info } = await sharp(sheetPath).extract(region).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const bgAt = (p) => { const i = p * ch; return mode.isBg(data[i], data[i + 1], data[i + 2]); };

  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (bg[p] || !bgAt(p)) return;
    bg[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * ch;
      if (bg[p]) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 0; continue; }
      const touchesBg = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);
      if (touchesBg) {
        const a = mode.edgeAlpha(data[i], data[i + 1], data[i + 2]);
        if (a !== null) {
          data[i + 3] = a;
          // the visible colour of a blended edge pixel is the border colour (white)
          data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
        }
      }
      if (data[i + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
  }
  if (maxX < 0) throw new Error(`${name}: nothing left after background removal`);

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  const cl = Math.max(0, minX - pad), ct = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - cl, chh = Math.min(h, maxY + pad + 1) - ct;

  const out = path.join(OUT, `${name}.webp`);
  await sharp(data, { raw: { width: w, height: h, channels: ch } })
    .extract({ left: cl, top: ct, width: cw, height: chh })
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(out);
  return `${name}.webp ${(statSync(out).size / 1024).toFixed(1)} KB`;
}

for (const [file, { bg, names }] of Object.entries(SHEETS)) {
  const sheetPath = path.join(SRC, file);
  for (let q = 0; q < 4; q++) console.log(await processQuadrant(sheetPath, q, names[q], MODES[bg]));
}
