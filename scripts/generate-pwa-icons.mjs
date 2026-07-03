import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const iconsDir = resolve('public', 'icons');
const samples = 4;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function insideRoundedRect(x, y, left, top, width, height, radius) {
  const nearestX = Math.max(left + radius, Math.min(x, left + width - radius));
  const nearestY = Math.max(top + radius, Math.min(y, top + height - radius));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared)) : 0;
  return Math.hypot(x - (x1 + amount * dx), y - (y1 + amount * dy));
}

const segments = [];
function line(x1, y1, x2, y2) { segments.push([x1, y1, x2, y2]); }
function outline(x, y, width, height) {
  line(x, y, x + width, y); line(x + width, y, x + width, y + height);
  line(x + width, y + height, x, y + height); line(x, y + height, x, y);
}

outline(3, 3, 7, 7);
outline(14, 3, 7, 7);
outline(3, 14, 7, 7);
outline(14, 14, 3, 3);
outline(18, 18, 3, 3);
line(18, 14, 21, 14); line(21, 14, 21, 16);
line(14, 19, 14, 21); line(14, 21, 16, 21);

function createIcon(size) {
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  const markScale = size * 0.55 / 24;
  const markOffset = size * 0.225;
  const strokeRadius = markScale * 0.9;
  const limeInset = size * 0.06;
  const limeSize = size - limeInset * 2;
  const limeRadius = size * 0.255;

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x += 1) {
      let limeCoverage = 0;
      let inkCoverage = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (insideRoundedRect(px, py, limeInset, limeInset, limeSize, limeSize, limeRadius)) limeCoverage += 1;
          const vx = (px - markOffset) / markScale;
          const vy = (py - markOffset) / markScale;
          if (segments.some(([x1, y1, x2, y2]) => distanceToSegment(vx, vy, x1, y1, x2, y2) <= strokeRadius / markScale)) inkCoverage += 1;
        }
      }
      const total = samples * samples;
      const lime = limeCoverage / total;
      const ink = Math.min(lime, inkCoverage / total);
      const background = [9, 11, 16];
      const accent = [201, 255, 56];
      const foreground = [11, 13, 17];
      const index = row + 1 + x * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const base = background[channel] * (1 - lime) + accent[channel] * lime;
        scanlines[index + channel] = Math.round(base * (1 - ink) + foreground[channel] * ink);
      }
      scanlines[index + 3] = 255;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(iconsDir, { recursive: true });
await Promise.all([192, 512].map((size) => writeFile(resolve(iconsDir, `icon-${size}.png`), createIcon(size))));
