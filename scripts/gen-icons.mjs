// Generates PWA PNG icons with no external dependencies (minimal PNG encoder).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BLUE = [29, 78, 216, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

// Simple car silhouette, scaled into a box (s = scale, o = offset)
function car(x, y, s = 1, o = 0) {
  const X = (x - o) / s, Y = (y - o) / s;
  const body = inRoundRect(X, Y, 0.16, 0.46, 0.84, 0.66, 0.06);
  const cabin = inRoundRect(X, Y, 0.28, 0.32, 0.70, 0.52, 0.08);
  const wheel = inCircle(X, Y, 0.32, 0.67, 0.075) || inCircle(X, Y, 0.68, 0.67, 0.075);
  const hub = inCircle(X, Y, 0.32, 0.67, 0.03) || inCircle(X, Y, 0.68, 0.67, 0.03);
  const window = inRoundRect(X, Y, 0.33, 0.36, 0.48, 0.47, 0.03) || inRoundRect(X, Y, 0.51, 0.36, 0.65, 0.47, 0.03);
  if (hub) return 'bg';
  if (wheel) return 'fg';
  if (window) return 'bg';
  if (body || cabin) return 'fg';
  return null;
}

function icon(rounded, maskable) {
  return (x, y) => {
    if (rounded && !inRoundRect(x, y, 0, 0, 1, 1, 0.22)) return CLEAR;
    const c = maskable ? car(x, y, 0.7, 0.15) : car(x, y);
    return c === 'fg' ? WHITE : BLUE;
  };
}

writeFileSync('public/icon-192.png', png(192, icon(true, false)));
writeFileSync('public/icon-512.png', png(512, icon(true, false)));
writeFileSync('public/icon-512-maskable.png', png(512, icon(false, true)));
writeFileSync('public/apple-touch-icon.png', png(180, icon(false, false)));
writeFileSync('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#1d4ed8"/>
<rect x="28" y="32" width="42" height="20" rx="8" fill="#fff"/>
<rect x="16" y="46" width="68" height="20" rx="6" fill="#fff"/>
<rect x="33" y="36" width="15" height="11" rx="3" fill="#1d4ed8"/><rect x="51" y="36" width="14" height="11" rx="3" fill="#1d4ed8"/>
<circle cx="32" cy="67" r="7.5" fill="#fff"/><circle cx="68" cy="67" r="7.5" fill="#fff"/>
<circle cx="32" cy="67" r="3" fill="#1d4ed8"/><circle cx="68" cy="67" r="3" fill="#1d4ed8"/>
</svg>`);
console.log('icons written');
