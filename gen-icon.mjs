// Konverter logo til icon.png (256px) og icon.ico (multi-størrelse)
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';

// Indlæs det originale logo
const src = await loadImage('EW Logo/EW.png');

function drawResized(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0, size, size);
  return c.toBuffer('image/png');
}

// Gem 256px PNG
fs.writeFileSync('assets/icon.png', drawResized(256));
console.log('icon.png OK');

// Byg ICO manuelt med 16, 32, 48, 256px
const sizes = [16, 32, 48, 256];
const pngBuffers = sizes.map(s => drawResized(s));

const headerSize = 6;
const entrySize  = 16;
const dirSize    = headerSize + entrySize * sizes.length;

const offsets = [];
let offset = dirSize;
for (const buf of pngBuffers) {
  offsets.push(offset);
  offset += buf.length;
}

const out = Buffer.alloc(offset);
let pos = 0;

out.writeUInt16LE(0, pos);
out.writeUInt16LE(1, pos+2);
out.writeUInt16LE(sizes.length, pos+4);
pos += 6;

for (let i = 0; i < sizes.length; i++) {
  const s = sizes[i];
  out.writeUInt8(s >= 256 ? 0 : s, pos);
  out.writeUInt8(s >= 256 ? 0 : s, pos+1);
  out.writeUInt8(0, pos+2);
  out.writeUInt8(0, pos+3);
  out.writeUInt16LE(1, pos+4);
  out.writeUInt16LE(32, pos+6);
  out.writeUInt32LE(pngBuffers[i].length, pos+8);
  out.writeUInt32LE(offsets[i], pos+12);
  pos += 16;
}

for (const buf of pngBuffers) {
  buf.copy(out, pos);
  pos += buf.length;
}

fs.writeFileSync('assets/icon.ico', out);
console.log('icon.ico OK', out.length, 'bytes');
