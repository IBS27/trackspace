import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("src/app/icon.svg", "utf8");
// Apple touch icons are full-bleed squares (iOS applies its own mask): no frame, no corner radius.
const appleSvg = svg
  .replace(/<rect[^>]*\/>/, '<rect x="0" y="0" width="32" height="32" fill="#000" />')
  .replace('viewBox="0 0 32 32"', 'viewBox="0 0 32 32" width="32" height="32"');

// At 16px the 1.25 stroke is sub-pixel: thicken lines and drop fine details.
const smallSvg = svg
  .replace('stroke-width="1.25"', 'stroke-width="2"')
  .replace(/\s*<circle[^>]*\/>/, "")
  .replace(/\s*<path d="M13\.6[^>]*\/>/, "")
  .replace(/\s*<path d="M18\.4[^>]*\/>/, "");

async function renderPng(source, size) {
  // Render at 8x and downsample for smoother anti-aliasing at small sizes.
  const density = (72 * size * 8) / 32;
  return sharp(Buffer.from(source), { density })
    .resize(size, size, { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bit depth
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

const [png16, png32, apple180, preview] = await Promise.all([
  renderPng(smallSvg, 16),
  renderPng(svg, 32),
  renderPng(appleSvg, 180),
  renderPng(svg, 256),
]);

writeFileSync("src/app/favicon.ico", buildIco([
  { size: 16, buf: png16 },
  { size: 32, buf: png32 },
]));
writeFileSync("src/app/icon.png", png32);
writeFileSync("src/app/apple-icon.png", apple180);
writeFileSync("/tmp/trackspace-icon-preview.png", preview);
console.log("done");
