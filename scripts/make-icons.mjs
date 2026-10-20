// Gera os ícones do JARVIS (PWA + fontes para o ícone Android) a partir do logo
// em assets/logo-source.webp. Uso: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'assets/logo-source.webp';
mkdirSync('public/icons', { recursive: true });

const logo = (size) => sharp(SRC).resize(size, size).png().toBuffer();

// Fundo no mesmo tom do logo (azul-marinho escuro com centro levemente mais claro)
const bgSvg = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs><radialGradient id="g" cx="50%" cy="50%" r="70%">
    <stop offset="0" stop-color="#0b1a52"/><stop offset=".55" stop-color="#060a2a"/><stop offset="1" stop-color="#020310"/>
  </radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);

// Logo reduzido com borda suavizada em círculo, para caber na zona segura do ícone adaptativo
async function softLogo(size) {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><radialGradient id="m" cx="50%" cy="50%" r="50%">
      <stop offset=".80" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>`);
  return sharp(await logo(size)).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

const roundedMask = (size, r) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" rx="${r}" fill="#fff"/></svg>`);

async function save(buf, file) {
  await sharp(buf).png().toFile(file);
  console.log('✓', file);
}

// PWA / navegador
for (const s of [192, 512]) {
  const rounded = await sharp(await logo(s)).ensureAlpha().composite([{ input: roundedMask(s, s * 0.22), blend: 'dest-in' }]).png().toBuffer();
  await save(rounded, `public/icons/icon-${s}.png`);
}
// maskable: o sistema recorta até 20% das bordas, então reduzimos o logo
await save(
  await sharp(bgSvg(512)).composite([{ input: await softLogo(400), gravity: 'center' }]).png().toBuffer(),
  'public/icons/icon-maskable-512.png',
);

// Android (@capacitor/assets): ícone legado, camadas do ícone adaptativo e splash
await save(await logo(1024), 'assets/icon-only.png');
await save(
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await softLogo(700), gravity: 'center' }])
    .png()
    .toBuffer(),
  'assets/icon-foreground.png',
);
await save(await sharp(bgSvg(1024)).png().toBuffer(), 'assets/icon-background.png');
const splash = await sharp(bgSvg(2732)).composite([{ input: await softLogo(1100), gravity: 'center' }]).png().toBuffer();
await save(splash, 'assets/splash.png');
await save(splash, 'assets/splash-dark.png');
