// Comprime as imagens de abertura (splash) geradas pelo @capacitor/assets,
// que com o logo detalhado passam de 8 MB e deixariam o APK pesado.
import sharp from 'sharp';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = 'android/app/src/main/res';
let before = 0;
let after = 0;
for (const dir of readdirSync(base)) {
  const file = join(base, dir, 'splash.png');
  if (!existsSync(file)) continue;
  const buf = readFileSync(file);
  const out = await sharp(buf).png({ palette: true, quality: 90, dither: 1, effort: 10 }).toBuffer();
  before += buf.length;
  if (out.length < buf.length) writeFileSync(file, out);
  after += Math.min(out.length, buf.length);
}
console.log(`splash: ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB`);
