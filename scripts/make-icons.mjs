// Gera os ícones do JARVIS (PWA + fontes para o ícone Android) a partir de SVG.
// Uso: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });
mkdirSync('assets', { recursive: true });

const defs = `
  <defs>
    <radialGradient id="bg" cx="30%" cy="20%" r="95%">
      <stop offset="0" stop-color="#2a2f7a"/>
      <stop offset=".55" stop-color="#121433"/>
      <stop offset="1" stop-color="#070814"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#7cc4ff" stop-opacity=".55"/>
      <stop offset="1" stop-color="#7cc4ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="core" cx="40%" cy="35%" r="65%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".3" stop-color="#bfe6ff"/>
      <stop offset=".7" stop-color="#7cc4ff"/>
      <stop offset="1" stop-color="#4b5bff"/>
    </radialGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7cc4ff"/>
      <stop offset="1" stop-color="#b28cff"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>`;

// Símbolo: reator circular com "J" no centro (centrado em 512,512)
const mark = (scale = 1) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <circle cx="512" cy="512" r="330" fill="url(#glow)"/>
    <circle cx="512" cy="512" r="250" fill="none" stroke="url(#ring)" stroke-width="34" stroke-dasharray="120 36" stroke-linecap="round" filter="url(#blur)" opacity=".8"/>
    <circle cx="512" cy="512" r="250" fill="none" stroke="url(#ring)" stroke-width="22" stroke-dasharray="120 36" stroke-linecap="round"/>
    <circle cx="512" cy="512" r="185" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="3"/>
    <circle cx="512" cy="512" r="165" fill="url(#core)"/>
    <path d="M560 395 v150 a70 70 0 0 1 -140 0" fill="none" stroke="#0b0d1c" stroke-width="44" stroke-linecap="round"/>
  </g>`;

const full = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
  <rect width="1024" height="1024" fill="url(#bg)"/>${mark(1)}</svg>`;

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
  <rect width="1024" height="1024" rx="230" fill="url(#bg)"/>${mark(1)}</svg>`;

// Ícone adaptativo do Android: só o símbolo (zona segura ~66%) + fundo separado
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${mark(0.62)}</svg>`;
const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}<rect width="1024" height="1024" fill="url(#bg)"/></svg>`;

const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">${defs}
  <rect width="2732" height="2732" fill="#070814"/>
  <g transform="translate(1366 1366) scale(.6) translate(-512 -512)">${mark(1)}</g></svg>`;

const out = async (svg, file, size) => {
  let img = sharp(Buffer.from(svg));
  if (size) img = img.resize(size, size);
  await img.png().toFile(file);
  console.log('✓', file);
};

await out(rounded, 'public/icons/icon-192.png', 192);
await out(rounded, 'public/icons/icon-512.png', 512);
await out(full, 'public/icons/icon-maskable-512.png', 512);
await out(full, 'assets/icon-only.png');
await out(foreground, 'assets/icon-foreground.png');
await out(background, 'assets/icon-background.png');
await out(splash, 'assets/splash.png');
await out(splash, 'assets/splash-dark.png');
