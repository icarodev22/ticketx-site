/* Testes automáticos do site (Playwright + Chromium).
   Uso:  npm i -D playwright && npx playwright install chromium   (uma vez)
         npm test
   Sobe um servidor local que imita a Vercel (pasta/ -> index.html, 404.html). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { EVENTOS } from '../data/eventos.js';
import { estadoEvento, hojeRecife } from '../js/render.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.includes('..')) { res.writeHead(400); return res.end(); }
  let f = path.join(RAIZ, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(308, { Location: p + '/' }); return res.end(); }
    f = path.join(f, 'index.html');
  }
  if (!fs.existsSync(f)) { res.writeHead(404, { 'Content-Type': TIPOS['.html'] }); return res.end(fs.readFileSync(path.join(RAIZ, '404.html'))); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => servidor.listen(0, r));
const BASE = `http://localhost:${servidor.address().port}`;

const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? {} : {});
let ok = 0, falhas = 0;
async function teste(nome, fn) {
  try { await fn(); ok++; console.log('  ✔', nome); }
  catch (e) { falhas++; console.log('  ✖', nome, '\n     ', e.message); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
async function abrir(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 800 }, reducedMotion: opts.reducedMotion || 'no-preference', permissions: opts.permissions || [] });
  const page = await ctx.newPage();
  const erros = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && !opts.ignore404) erros.push(`${r.status()} ${r.url()}`); });
  if (opts.antes) await opts.antes(page, ctx);
  const resp = await page.goto(BASE + url, { waitUntil: 'load' });
  return { page, ctx, erros, resp };
}
const hoje = hojeRecife();
const ativos = EVENTOS.filter(e => !['encerrado', 'cancelado'].includes(estadoEvento(e, hoje)));
const paginas = ['/', '/agenda/', ...EVENTOS.map(e => `/eventos/${e.slug}/`)];

console.log('\nPáginas e console');
for (const url of paginas) {
  await teste(`${url} abre sem erros no console nem arquivos 404`, async () => {
    const { page, ctx, erros, resp } = await abrir(url);
    await page.waitForLoadState('networkidle');
    assert(resp.status() === 200, 'status ' + resp.status());
    assert(!erros.length, erros.join(' | '));
    // ids duplicados, links vazios ou "#"
    const prob = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
      const vazios = [...document.querySelectorAll('a')].filter(a => { const h = a.getAttribute('href'); return !h || h === '#' || h.startsWith('javascript:'); }).map(a => a.outerHTML.slice(0, 80));
      const blank = [...document.querySelectorAll('a[target=_blank]')].filter(a => !/noopener/.test(a.rel)).map(a => a.href);
      const h1 = document.querySelectorAll('h1').length;
      const semAlt = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length;
      return { dup, vazios, blank, h1, semAlt };
    });
    assert(!prob.dup.length, 'IDs duplicados: ' + prob.dup);
    assert(!prob.vazios.length, 'links vazios: ' + prob.vazios);
    assert(!prob.blank.length, 'target=_blank sem noopener: ' + prob.blank);
    assert(prob.h1 === 1, 'esperado 1 h1, achou ' + prob.h1);
    assert(!prob.semAlt, prob.semAlt + ' imagens sem alt');
    await ctx.close();
  });
}

console.log('\nPáginas de evento');
for (const ev of EVENTOS) {
  await teste(`${ev.slug}: link de compra, metadados e compartilhamento`, async () => {
    const { page, ctx } = await abrir(`/eventos/${ev.slug}/`);
    const st = estadoEvento(ev, hoje);
    const href = await page.locator('[data-cta] [data-compra]').getAttribute('href');
    if (['encerrado', 'cancelado', 'esgotado'].includes(st) || !ev.compra) assert(href === null, `evento ${st} não deveria ter link de compra`);
    else assert(href === ev.compra.url, `link de compra alterado: ${href} != ${ev.compra.url}`);
    const canon = await page.locator('link[rel=canonical]').getAttribute('href');
    assert(canon === `https://ticketxco.com.br/eventos/${ev.slug}/`, 'canonical errado: ' + canon);
    const ogt = await page.locator('meta[property="og:title"]').getAttribute('content');
    assert(ogt.includes(ev.nome), 'og:title não cita o evento');
    const ogi = await page.locator('meta[property="og:image"]').getAttribute('content');
    const r = await page.request.get(ogi.replace('https://ticketxco.com.br', BASE));
    assert(r.ok(), 'og:image não existe: ' + ogi);
    const wa = await page.locator('.share a[href^="https://wa.me/?text="]').getAttribute('href');
    const txt = decodeURIComponent(wa.split('text=')[1]);
    assert(txt.includes(ev.nome) && txt.includes(`/eventos/${ev.slug}/`), 'WhatsApp sem nome/URL do evento');
    for (const s of await page.locator('script[type="application/ld+json"]').allTextContents()) JSON.parse(s);
    if (ev.compra?.tipo === 'whatsapp') assert(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(ev.compra.url), 'link whatsapp inválido');
    await ctx.close();
  });
}

console.log('\nAgenda, busca e filtros');
await teste('agenda lista todos os eventos (ativos + encerrados)', async () => {
  const { page, ctx } = await abrir('/agenda/');
  const ativosNaTela = await page.locator('[data-resultados] .card').count();
  const passados = await page.locator('[data-passados-lista] .card').count();
  assert(ativosNaTela === ativos.length, `ativos ${ativosNaTela} != ${ativos.length}`);
  assert(ativosNaTela + passados === EVENTOS.length, 'faltam eventos');
  await ctx.close();
});
await teste('busca por artista sem acento ("safadao") encontra os eventos certos', async () => {
  const { page, ctx } = await abrir('/agenda/');
  await page.fill('#busca-agenda', 'safadao');
  await page.waitForTimeout(400);
  const slugs = await page.locator('[data-resultados] .card').evaluateAll(cs => cs.map(c => c.dataset.slug));
  const esperado = ativos.filter(e => JSON.stringify(e.lineup || '').includes('Safadão')).map(e => e.slug);
  assert(slugs.length === esperado.length && esperado.every(s => slugs.includes(s)), `achou ${slugs} esperado ${esperado}`);
  assert(page.url().includes('q=safadao'), 'URL não guardou a busca');
  await ctx.close();
});
await teste('busca sem resultado mostra mensagem e "limpar" restaura tudo', async () => {
  const { page, ctx } = await abrir('/agenda/');
  await page.fill('#busca-agenda', 'xyzabc');
  await page.waitForTimeout(400);
  assert(await page.locator('[data-vazio] .empty').isVisible(), 'sem mensagem de vazio');
  await page.locator('[data-vazio] [data-limpar]').click();
  assert(await page.locator('[data-resultados] .card').count() === ativos.length, 'não restaurou');
  assert(await page.inputValue('#busca-agenda') === '', 'campo não limpou');
  await ctx.close();
});
await teste('categoria + cidade + busca funcionam juntas e vêm da URL', async () => {
  const { page, ctx } = await abrir('/agenda/?categoria=carnaval&cidade=Recife');
  const slugs = await page.locator('[data-resultados] .card').evaluateAll(cs => cs.map(c => c.dataset.slug));
  const esperado = ativos.filter(e => e.categorias.includes('carnaval') && e.cidade === 'Recife').map(e => e.slug);
  assert(JSON.stringify(slugs.sort()) === JSON.stringify(esperado.sort()), `${slugs} != ${esperado}`);
  assert(await page.locator('.chip[data-cat=carnaval]').getAttribute('aria-pressed') === 'true', 'chip não marcado');
  await ctx.close();
});
await teste('ordenação por data (mais distantes primeiro)', async () => {
  const { page, ctx } = await abrir('/agenda/');
  await page.selectOption('#ordem-agenda', 'desc');
  const primeiro = await page.locator('[data-resultados] .card').first().getAttribute('data-slug');
  const ult = [...ativos].sort((a, b) => b.datas[0].localeCompare(a.datas[0]))[0];
  assert(primeiro === ult.slug, `${primeiro} != ${ult.slug}`);
  await ctx.close();
});
await teste('home: filtro troca prateleiras por resultados e volta', async () => {
  const { page, ctx } = await abrir('/');
  await page.locator('#agenda .chip[data-cat=vaquejada]').click();
  assert(await page.locator('[data-prateleiras]').isHidden(), 'prateleiras continuam');
  const n = await page.locator('[data-resultados] .card').count();
  assert(n === ativos.filter(e => e.categorias.includes('vaquejada')).length, 'contagem errada ' + n);
  await page.locator('#agenda .chip[data-cat=""]').click();
  assert(await page.locator('[data-prateleiras]').isVisible(), 'prateleiras não voltaram');
  await ctx.close();
});
await teste('setas da prateleira rolam os cards', async () => {
  const { page, ctx } = await abrir('/');
  const row = page.locator('.shelf').first().locator('.shelf-row');
  await row.scrollIntoViewIfNeeded();
  await page.locator('.shelf').first().locator('button[data-dir="1"]').click();
  await page.waitForTimeout(700);
  assert(await row.evaluate(r => r.scrollLeft) > 50, 'não rolou');
  await ctx.close();
});

console.log('\nNavegação');
await teste('link antigo /#barchef redireciona para /eventos/barchef/', async () => {
  const { page, ctx } = await abrir('/#barchef');
  await page.waitForURL('**/eventos/barchef/');
  await ctx.close();
});
await teste('evento inexistente mostra a página 404', async () => {
  const { page, ctx, resp } = await abrir('/eventos/nao-existe/', { ignore404: true });
  assert(resp.status() === 404, 'status ' + resp.status());
  assert((await page.locator('h1').textContent()).includes('não encontrada'), 'sem 404');
  await ctx.close();
});
await teste('voltar do evento para a agenda mantém o filtro', async () => {
  const { page, ctx } = await abrir('/agenda/?categoria=vaquejada');
  await page.locator('[data-resultados] .card-link').first().click();
  await page.waitForURL('**/eventos/**');
  await page.goBack();
  await page.waitForURL('**/agenda/?categoria=vaquejada');
  assert(await page.locator('.chip[data-cat=vaquejada]').getAttribute('aria-pressed') === 'true', 'filtro perdido');
  await ctx.close();
});
await teste('menu mobile abre, fecha com Esc e devolve o foco', async () => {
  const { page, ctx } = await abrir('/', { viewport: { width: 375, height: 740 } });
  await page.waitForSelector('.intro', { state: 'detached', timeout: 6000 });
  await page.click('.menu-btn');
  assert(await page.locator('#menu.open').count() === 1, 'não abriu');
  await page.keyboard.press('Escape');
  assert(await page.locator('#menu.open').count() === 0, 'não fechou');
  assert(await page.evaluate(() => document.activeElement.classList.contains('menu-btn')), 'foco não voltou');
  await page.click('.menu-btn');
  await page.locator('#menu nav a[href="/#duvidas"]').click();
  assert(await page.locator('#menu.open').count() === 0, 'não fechou ao navegar');
  await ctx.close();
});
await teste('teclado: primeiro Tab vai para "Pular para o conteúdo"', async () => {
  const { page, ctx } = await abrir('/agenda/');
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement.classList.contains('skip')), 'skip link não é o primeiro');
  await ctx.close();
});
await teste('copiar link copia a URL oficial do evento', async () => {
  const { page, ctx } = await abrir('/eventos/bololo/', { permissions: ['clipboard-read', 'clipboard-write'] });
  await page.waitForSelector('.intro', { state: 'detached', timeout: 6000 });
  await page.click('[data-copy]');
  const txt = await page.evaluate(() => navigator.clipboard.readText());
  assert(txt === 'https://ticketxco.com.br/eventos/bololo/', txt);
  assert(await page.locator('.toast.show').isVisible(), 'sem aviso');
  await ctx.close();
});

console.log('\nCarregamento e falhas');
await teste('abertura some sozinha e não reaparece na navegação interna', async () => {
  const { page, ctx } = await abrir('/');
  const t0 = Date.now();
  await page.waitForSelector('.intro', { state: 'detached', timeout: 6000 });
  assert(Date.now() - t0 < 5000, 'demorou demais');
  await page.goto(BASE + '/agenda/');
  assert(await page.evaluate(() => document.documentElement.classList.contains('no-intro')), 'abertura repetiu');
  await ctx.close();
});
await teste('fontes e imagens bloqueadas: abertura libera a tela e flyer mostra o nome', async () => {
  const { page, ctx } = await abrir('/eventos/barchef/', {
    ignore404: true,
    antes: async p => { await p.route(/\.(woff2|webp|jpg)$/, r => r.abort()); },
  });
  await page.waitForSelector('.intro', { state: 'detached', timeout: 6000 });
  assert(await page.locator('.ev-poster.img-failed').count() === 1, 'flyer quebrado sem tratamento');
  await ctx.close();
});
await teste('sem JavaScript a abertura some (CSS) e o conteúdo aparece', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.waitForTimeout(6800);
  assert(await page.locator('.intro').evaluate(el => getComputedStyle(el).visibility) === 'hidden', 'abertura presa');
  assert(await page.locator('.card').count() > 0, 'cards não estão no HTML');
  await ctx.close();
});
await teste('prefers-reduced-motion: abertura sai rápido', async () => {
  const { page, ctx } = await abrir('/', { reducedMotion: 'reduce' });
  await page.waitForSelector('.intro', { state: 'detached', timeout: 3000 });
  await ctx.close();
});
await teste('estado pela data: depois do evento a página mostra "encerrado" e tira o link', async () => {
  const futuro = ativos.find(e => e.compra);
  const depois = new Date(Date.parse(futuro.datas[futuro.datas.length - 1] + 'T12:00:00-03:00') + 2 * 86400000);
  const { page, ctx } = await abrir(`/eventos/${futuro.slug}/`, { antes: async p => { await p.clock.setFixedTime(depois); } });
  await page.waitForLoadState('networkidle');
  assert((await page.locator('[data-estado-tag]').textContent()).includes('encerrado'), 'tag não mudou');
  assert(await page.locator('[data-cta] [data-compra]').getAttribute('href') === null, 'link continua ativo');
  await ctx.close();
});

console.log('\nResponsividade (sem rolagem horizontal)');
const larguras = [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440, 1920];
for (const url of ['/', '/agenda/', '/eventos/carvalheira-na-ladeira/', '/eventos/barchef/', '/404.html']) {
  await teste(`${url} em ${larguras.join(', ')} px`, async () => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const ruins = [];
    for (const w of larguras) {
      await page.setViewportSize({ width: w, height: w < 800 ? 760 : 900 });
      await page.goto(BASE + url);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w) ruins.push(`${w}px→${sw}px`);
    }
    // horizontal no celular
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(BASE + url);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 844) ruins.push(`844x390→${sw}px`);
    assert(!ruins.length, 'rolagem horizontal: ' + ruins.join(', '));
    await ctx.close();
  });
}

await browser.close();
servidor.close();
console.log(`\n${ok} passaram, ${falhas} falharam\n`);
process.exit(falhas ? 1 : 0);
