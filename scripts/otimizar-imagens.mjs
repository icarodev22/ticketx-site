/* Gera as versões leves dos flyers e as prévias de compartilhamento.
   Roda sozinho antes do build (npm run build), inclusive na Vercel, então um
   flyer enviado pelo painel ganha as versões leves sem ninguém rodar nada.

   Para cada evento cria, a partir do flyer:
     assets/events/opt/<slug>-480.webp, -640.webp, -960.webp, <slug>-960.jpg
     assets/og/<slug>.jpg   (1200x630, prévia do WhatsApp/Instagram)
   e, para cada foto da festa, assets/events/fotos/<nome>-480/640/854/960.webp.
   e anota em assets/events/opt/fontes.json qual flyer gerou cada versão,
   para refazer só quando o flyer muda.

   Precisa do pacote "sharp" (npm install). Sem ele, avisa e segue: o site
   usa o flyer original e a prévia padrão. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { EVENTOS } from '../data/eventos.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arq = p => path.join(RAIZ, p);
const OPT = 'assets/events/opt', OG = 'assets/og';
const MANIFESTO = arq(`${OPT}/fontes.json`);

let sharp;
try { sharp = (await import('sharp')).default; }
catch { console.warn('otimizar-imagens: pacote "sharp" não instalado; flyers novos vão sem versão leve (rode npm install).'); process.exit(0); }

fs.mkdirSync(arq(OPT), { recursive: true });
fs.mkdirSync(arq(OG), { recursive: true });
const manifesto = fs.existsSync(MANIFESTO) ? JSON.parse(fs.readFileSync(MANIFESTO, 'utf8')) : {};
const saidas = slug => [480, 640, 960].map(w => `${OPT}/${slug}-${w}.webp`).concat(`${OPT}/${slug}-960.jpg`, `${OG}/${slug}.jpg`);

async function gerarPrevia(src, destino) {
  const W = 1200, H = 630;
  const fundo = await sharp(src).rotate().resize(W, H, { fit: 'cover' }).blur(28).modulate({ brightness: 0.45 }).toBuffer();
  const fl = await sharp(src).rotate().resize({ width: W - 120, height: H - 60, fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const { width: fw, height: fh } = fl.info;
  const x = Math.round((W - fw) / 2), y = Math.round((H - fh) / 2);
  const mascara = Buffer.from(`<svg width="${fw}" height="${fh}"><rect width="${fw}" height="${fh}" rx="22" fill="#fff"/></svg>`);
  const flyer = await sharp(fl.data).ensureAlpha().composite([{ input: mascara, blend: 'dest-in' }]).png().toBuffer();
  const sombra = await sharp(Buffer.from(`<svg width="${W}" height="${H}"><rect x="${x + 6}" y="${y + 12}" width="${fw}" height="${fh}" rx="22" fill="#000" fill-opacity=".6"/></svg>`)).blur(14).png().toBuffer();
  const logo = await sharp(arq('assets/brand/icon.png')).resize({ height: 84 }).toBuffer({ resolveWithObject: true });
  await sharp(fundo)
    .composite([{ input: sombra }, { input: flyer, left: x, top: y }, { input: logo.data, left: W - logo.info.width - 34, top: H - 84 - 30 }])
    .jpeg({ quality: 84, progressive: true, mozjpeg: true }).toFile(destino);
}

let feitos = 0;
for (const ev of EVENTOS) {
  const src = arq((ev.flyer || `assets/events/${ev.slug}.jpg`).replace(/^\//, ''));
  if (!fs.existsSync(src)) continue;
  const hash = crypto.createHash('sha1').update(fs.readFileSync(src)).digest('hex').slice(0, 12);
  const prontas = saidas(ev.slug).every(p => fs.existsSync(arq(p)));
  if (prontas && (manifesto[ev.slug] === hash || manifesto[ev.slug] === undefined)) { manifesto[ev.slug] = hash; continue; }
  try {
    for (const w of [480, 640, 960]) await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 72, effort: 6 }).toFile(arq(`${OPT}/${ev.slug}-${w}.webp`));
    await sharp(src).rotate().resize({ width: 960, withoutEnlargement: true }).flatten({ background: '#07040f' }).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(arq(`${OPT}/${ev.slug}-960.jpg`));
    await gerarPrevia(src, arq(`${OG}/${ev.slug}.jpg`));
    manifesto[ev.slug] = hash;
    feitos++;
    console.log('otimizar-imagens: ok', ev.slug);
  } catch (e) {
    console.warn(`otimizar-imagens: não consegui processar o flyer de ${ev.slug} (${e.message}); o site usa o original.`);
  }
}
// fotos da festa (seção "Clima da festa"): versões WebP ao lado do original
for (const ev of EVENTOS) for (const f of ev.fotos || []) {
  const src = arq(`assets/events/fotos/${f.arquivo}`);
  const base = f.arquivo.replace(/\.jpe?g$/i, '');
  const faltam = [480, 640, 854, 960].filter(w => !fs.existsSync(arq(`assets/events/fotos/${base}-${w}.webp`)));
  try {
    for (const w of faltam) await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 74, effort: 6 }).toFile(arq(`assets/events/fotos/${base}-${w}.webp`));
    if (faltam.length) console.log('otimizar-imagens: ok foto', f.arquivo);
  } catch (e) {
    console.warn(`otimizar-imagens: não consegui processar a foto ${f.arquivo} (${e.message}).`);
  }
}

const slugs = new Set(EVENTOS.map(ev => ev.slug));
fs.writeFileSync(MANIFESTO, JSON.stringify(Object.fromEntries(Object.entries(manifesto).filter(([s]) => slugs.has(s)).sort()), null, 2) + '\n');
if (feitos) console.log(`otimizar-imagens: ${feitos} flyer(s) processado(s).`);
