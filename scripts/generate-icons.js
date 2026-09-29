import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createPng(width, height, isMaskable = false) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // color type RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data: height scanlines, each (1 + width * 4) bytes
  const scanlineLen = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLen);

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) / 2;
  const cornerRadius = isMaskable ? 0 : width * 0.22;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLen;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Base gradient: Stone-950 (#0c0a09) to Orange (#f97316)
      const t = (x + y) / (width + height);
      let r = Math.round(249 * t + 12 * (1 - t));
      let g = Math.round(115 * t + 10 * (1 - t));
      let b = Math.round(22 * t + 9 * (1 - t));
      let a = 255;

      // Check rounded corner clip if not maskable
      if (!isMaskable) {
        // Distance to corners
        let dx = 0;
        let dy = 0;
        if (x < cornerRadius) dx = cornerRadius - x;
        else if (x > width - cornerRadius) dx = x - (width - cornerRadius);

        if (y < cornerRadius) dy = cornerRadius - y;
        else if (y > height - cornerRadius) dy = y - (height - cornerRadius);

        if (dx > 0 && dy > 0) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > cornerRadius) {
            a = 0;
          }
        }
      }

      if (a > 0) {
        // Draw Chef Hat & Pan Symbol in central safe zone
        const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const relY = (y - cy) / maxRadius;
        const relX = (x - cx) / maxRadius;

        // Golden inner ring
        if (distFromCenter < maxRadius * 0.78 && distFromCenter > maxRadius * 0.72) {
          r = 251; g = 191; b = 36; // Amber-400
        }

        // Center Chef Hat Icon shape
        // Hat base
        if (relY >= 0.15 && relY <= 0.35 && Math.abs(relX) <= 0.35) {
          r = 255; g = 255; b = 255; // White
        }
        // Hat puffs
        const inCenterPuff = (relX ** 2) / (0.24 ** 2) + ((relY + 0.15) ** 2) / (0.25 ** 2) <= 1;
        const inLeftPuff = ((relX + 0.22) ** 2) / (0.19 ** 2) + ((relY + 0.05) ** 2) / (0.2 ** 2) <= 1;
        const inRightPuff = ((relX - 0.22) ** 2) / (0.19 ** 2) + ((relY + 0.05) ** 2) / (0.2 ** 2) <= 1;

        if (inCenterPuff || inLeftPuff || inRightPuff) {
          r = 254; g = 243; b = 199; // Amber-100
        }

        // Orange ribbon on hat band
        if (relY >= 0.23 && relY <= 0.27 && Math.abs(relX) <= 0.34) {
          r = 249; g = 115; b = 22; // Orange-500
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');

const icon192 = createPng(192, 192, false);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), icon192);

const icon512 = createPng(512, 512, false);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), icon512);

const maskable512 = createPng(512, 512, true);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), maskable512);

const appleTouch = createPng(180, 180, false);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);

console.log('Successfully generated PWA PNG icons in /public!');
