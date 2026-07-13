import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT  = join(ROOT, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// SVG do V mark Vertos
const makeSvg = (size, padding = 0) => {
  const p = Math.round(size * padding);
  const s = size - p * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#0E1116"/>
  <svg x="${p}" y="${p}" width="${s}" height="${s}" viewBox="0 0 200 200">
    <path d="M32 42 L100 158 L168 42" fill="none" stroke="white" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M100 100 L134 42" fill="none" stroke="#0DB878" stroke-width="13" stroke-linecap="round"/>
  </svg>
</svg>`;
};

// ícone para atalho de cor sólida esmeralda
const makeShortcutSvg = (size, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#0DB878"/>
  <svg x="${Math.round(size*0.15)}" y="${Math.round(size*0.15)}" width="${Math.round(size*0.7)}" height="${Math.round(size*0.7)}" viewBox="0 0 200 200">
    <path d="M32 42 L100 158 L168 42" fill="none" stroke="white" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M100 100 L134 42" fill="none" stroke="#0E1116" stroke-width="15" stroke-linecap="round"/>
  </svg>
</svg>`;

const icons = [
  { file: 'icon-192x192.png',          size: 192, padding: 0    },
  { file: 'icon-192x192-maskable.png', size: 192, padding: 0.12 },
  { file: 'icon-512x512.png',          size: 512, padding: 0    },
  { file: 'icon-512x512-maskable.png', size: 512, padding: 0.12 },
];

for (const { file, size, padding } of icons) {
  const svg = Buffer.from(makeSvg(size, padding));
  await sharp(svg).png().toFile(join(OUT, file));
  console.log(`✓ ${file}`);
}

// Shortcut icons
for (const [name, size] of [['dashboard-icon-192x192.png', 192], ['finance-icon-192x192.png', 192]]) {
  const svg = Buffer.from(makeShortcutSvg(size));
  await sharp(svg).png().toFile(join(OUT, name));
  console.log(`✓ ${name}`);
}

console.log('\nTodos os ícones gerados com sucesso!');
