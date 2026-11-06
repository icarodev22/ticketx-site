/* Testes automáticos do site (Playwright + Chromium).
   Uso:  npm i -D playwright && npx playwright install chromium   (uma vez)
         npm test
   Sobe um servidor local que imita a Vercel (pasta/ -> index.html, 404.html). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { EVENTOS, normalizar } from '../data/eventos.js';
import { estadoEvento, hojeRecife, agoraRecife, selecionarDestaques, podeSerDestaque, avisoAtivo, acaoCompra, cardHTML, destaquesHTML, MAX_DESTAQUES } from '../js/render.js';

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
const CEL_ = { viewport: { width: 390, height: 844 } };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
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
// categoria com eventos ativos hoje (os testes não dependem de uma festa específica)
const CAT = ['vaquejada', 'praia', 'carvalheira', 'carnaval', 'samba', 'reveillon'].find(c => ativos.some(e => e.categorias.includes(c)));
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

await teste('aviso "Últimos ingressos" aparece no card e na página e some depois da data', async () => {
  const ev = EVENTOS.find(e => e.aviso && ativos.includes(e));
  if (!ev) return;
  const { page, ctx } = await abrir('/agenda/');
  assert((await page.locator(`.card[data-slug="${ev.slug}"] .badge-aviso`).textContent()).includes(ev.aviso.titulo), 'sem selo no card');
  await page.goto(`${BASE}/eventos/${ev.slug}/`);
  assert(await page.locator('[data-aviso]').isVisible(), 'sem aviso na página');
  if (ev.fotos?.length) assert(await page.locator('.photo img').count() === ev.fotos.length, 'fotos faltando');
  await ctx.close();
  const depois = new Date(Date.parse(ev.datas[ev.datas.length - 1] + 'T12:00:00-03:00') + 2 * 86400000);
  const r = await abrir(`/eventos/${ev.slug}/`, { antes: async p => { await p.clock.setFixedTime(depois); } });
  await r.page.waitForLoadState('networkidle');
  assert(await r.page.locator('[data-aviso]').count() === 0, 'aviso continua depois do evento');
  await r.ctx.close();
});

console.log('\nDestaques: regra (eventos de teste, não vão para o site)');
{
  // eventos fictícios só para testar a regra; nada disto é gravado no site
  const AGORA = '2027-01-10T15:00';
  const base = { local: 'Local teste', cidade: 'Recife', compra: { tipo: 'link', url: 'https://exemplo.com/compra' } };
  const mk = (slug, extra) => normalizar(slug, { nome: slug, ...base, ...extra });
  const T = {
    carvaEncerrado: mk('t-carva-encerrado', { datas: ['2027-01-05'], categorias: ['carvalheira'] }),
    carvaAtivo: mk('t-carva-ativo', { datas: ['2027-03-20'], categorias: ['carvalheira'] }),
    carvaPerto: mk('t-carva-perto', { datas: ['2027-02-01'], categorias: ['carvalheira'] }),
    carnaval: mk('t-carnaval', { datas: ['2027-01-20'], categorias: ['carnaval'] }),
    carnavalNome: mk('t-previa', { nome: 'Prévia de Carnaval Teste', datas: ['2027-01-22'], categorias: ['samba'] }),
    outro: mk('t-outro', { datas: ['2027-01-11'], categorias: ['samba'] }),
    outroSemLink: mk('t-outro-sem-link', { datas: ['2027-01-12'], categorias: ['praia'], compra: { tipo: 'nenhum' } }),
    ultimosSim: mk('t-ultimos-sim', { datas: ['2027-01-15'], categorias: ['praia'], ultimosIngressos: true }),
    ultimosNao: mk('t-ultimos-nao', { datas: ['2027-01-16'], categorias: ['praia'], ultimosIngressos: false }),
    esgotado: mk('t-esgotado', { datas: ['2027-01-18'], categorias: ['carvalheira'], status: 'esgotado', ultimosIngressos: true }),
    cancelado: mk('t-cancelado', { datas: ['2027-01-19'], categorias: ['carvalheira'], status: 'cancelado' }),
    adiado: mk('t-adiado', { datas: ['2027-01-19'], categorias: ['carnaval'], status: 'adiado' }),
    hojeMaisTarde: mk('t-hoje-20h', { datas: ['2027-01-10'], hora: '20:00', categorias: ['carvalheira'] }),
    hojeJaComecou: mk('t-hoje-14h', { datas: ['2027-01-10'], hora: '14:00', categorias: ['carvalheira'] }),
    legado: mk('t-legado', { datas: ['2027-01-25'], categorias: ['praia'], aviso: { titulo: 'Últimos ingressos', texto: 'quase no fim' } }),
  };
  const todos = Object.values(T);
  const lista = selecionarDestaques(todos, AGORA).map(e => e.slug);
  const pos = slug => lista.indexOf(slug);
  const ctxT = { hoje: AGORA.slice(0, 10), categorias: [{ id: 'carvalheira', nome: 'Carvalheira' }, { id: 'carnaval', nome: 'Carnaval' }, { id: 'samba', nome: 'Samba' }, { id: 'praia', nome: 'Praia' }] };

  await teste('1. Carvalheira encerrado não aparece nos destaques', async () => {
    assert(pos('t-carva-encerrado') === -1, lista.join());
  });
  await teste('2. Carvalheira ativo vem antes de todos os outros', async () => {
    const carva = lista.filter(s => T[Object.keys(T).find(k => T[k].slug === s)].categorias.includes('carvalheira'));
    assert(lista.slice(0, carva.length).join() === carva.join(), lista.join());
    assert(pos('t-carva-perto') < pos('t-carva-ativo'), 'Carvalheira mais próximo deveria vir primeiro');
  });
  await teste('3. Carnaval vem depois da Carvalheira (categoria ou nome com "Carnaval")', async () => {
    assert(pos('t-carnaval') > pos('t-carva-ativo') && pos('t-previa') > pos('t-carva-ativo'), lista.join());
    assert(pos('t-carnaval') < pos('t-outro') && pos('t-previa') < pos('t-outro'), lista.join());
  });
  await teste('4. demais eventos vêm por último; com link de compra antes de "Em breve"', async () => {
    assert(pos('t-outro') > pos('t-previa'), lista.join());
    assert(pos('t-outro-sem-link') === lista.length - 1, 'sem link deveria ser o último: ' + lista.join());
  });
  await teste('5. ultimosIngressos: true mostra a etiqueta (card e destaques)', async () => {
    assert(avisoAtivo(T.ultimosSim, 'proximo')?.titulo === 'Últimos ingressos', 'sem aviso');
    assert(cardHTML(T.ultimosSim, ctxT).includes('data-ultimos'), 'card sem etiqueta');
    assert(destaquesHTML([T.ultimosSim], ctxT).includes('data-ultimos'), 'destaque sem etiqueta');
    assert(avisoAtivo(T.legado, 'proximo')?.texto === 'quase no fim', 'formato antigo (aviso) parou de funcionar');
  });
  await teste('6. ultimosIngressos: false não mostra a etiqueta', async () => {
    assert(!T.ultimosNao.aviso && !cardHTML(T.ultimosNao, ctxT).includes('data-ultimos'), 'etiqueta indevida');
    assert(!cardHTML(T.outro, ctxT).includes('data-ultimos'), 'etiqueta em evento sem a opção');
  });
  await teste('7. esgotado: sem etiqueta, sem link e fora dos destaques (mesmo com ultimosIngressos)', async () => {
    const st = estadoEvento(T.esgotado, ctxT.hoje);
    assert(st === 'esgotado' && !avisoAtivo(T.esgotado, st), 'etiqueta em esgotado');
    assert(!cardHTML(T.esgotado, ctxT).includes('data-ultimos'), 'card esgotado com etiqueta');
    assert(acaoCompra(T.esgotado, st).href === null, 'esgotado com link de compra');
    assert(pos('t-esgotado') === -1 && pos('t-cancelado') === -1 && pos('t-adiado') === -1, lista.join());
  });
  await teste('8. evento que acabou de passar do horário sai dos destaques', async () => {
    assert(pos('t-hoje-14h') === -1, 'começou às 14h e às 15h ainda está nos destaques');
    assert(pos('t-hoje-20h') === 0, 'evento de hoje às 20h deveria estar em destaque (Carvalheira mais próximo)');
    assert(!podeSerDestaque(T.hojeMaisTarde, '2027-01-10T20:00'), 'às 20:00 deveria sair');
    assert(podeSerDestaque(T.hojeMaisTarde, '2027-01-10T19:59'), 'às 19:59 ainda vale');
    const semHora = mk('t-sem-hora', { datas: ['2027-01-10'], categorias: ['praia'] });
    assert(podeSerDestaque(semHora, '2027-01-10T23:59') && !podeSerDestaque(semHora, '2027-01-11T00:00'), 'sem hora vale até o fim do dia');
  });
  await teste('agoraRecife usa o fuso de Recife (UTC-3)', async () => {
    assert(agoraRecife(new Date('2026-11-06T02:30:00Z')) === '2026-11-05T23:30', agoraRecife(new Date('2026-11-06T02:30:00Z')));
  });
}

console.log('\nDestaques: home');
const esperados = () => selecionarDestaques(EVENTOS, agoraRecife()).slice(0, MAX_DESTAQUES).map(e => e.slug);
await teste('home mostra os destaques na ordem da regra e nenhum encerrado', async () => {
  const { page, ctx } = await abrir('/');
  await page.waitForLoadState('networkidle');
  const vistos = await page.locator('#destaques .spotlight, #destaques .next-item').evaluateAll(xs => xs.map(x => x.dataset.slug));
  assert(vistos.join() === esperados().join(), `${vistos} != ${esperados()}`);
  for (const s of vistos) {
    const ev = EVENTOS.find(e => e.slug === s);
    assert(!['encerrado', 'cancelado', 'esgotado'].includes(estadoEvento(ev, hojeRecife())), s + ' não deveria estar em destaque');
  }
  await ctx.close();
});
await teste('página aberta depois do evento: o navegador tira o evento dos destaques sem novo build', async () => {
  const primeiro = esperados()[0];
  if (!primeiro) return;
  const ev = EVENTOS.find(e => e.slug === primeiro);
  // 1 minuto depois do início da última sessão (ou do fim do dia, sem hora)
  const fim = ev.datas[ev.datas.length - 1] + 'T' + (ev.hora || '23:59') + ':00-03:00';
  const depois = new Date(Date.parse(fim) + 2 * 60000);
  for (const opts of [{}, CEL_]) {
    const { page, ctx, erros } = await abrir('/', { ...opts, antes: async p => { await p.clock.setFixedTime(depois); } });
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(s => !document.querySelector(`#destaques [data-slug="${s}"]`), primeiro, { timeout: 5000 });
    assert(!erros.length, erros.join(' | '));
    await ctx.close();
  }
});
await teste('9. etiqueta bem posicionada no celular e no computador (carrossel, destaque, cards)', async () => {
  const alvo = esperados()[0];
  if (!alvo) return;
  // liga a etiqueta só nesta cópia da página (o arquivo não muda)
  const antes = async p => {
    await p.route(BASE + '/', async r => {
      const resp = await r.fetch();
      let html = await resp.text();
      html = html.replace(/(<script type="application\/json" id="tx-dados">)([\s\S]*?)(<\/script>)/, (m, a, json, c) => {
        const d = JSON.parse(json);
        d.eventos.find(e => e.slug === alvo).aviso = { titulo: 'Últimos ingressos', texto: 'Teste' };
        return a + JSON.stringify(d).replace(/</g, '\\u003c') + c;
      });
      await r.fulfill({ response: resp, body: html });
    });
  };
  for (const [nome, opts, sel] of [['celular', CEL_, `.mcar-slide[data-slug="${alvo}"]`], ['computador', {}, `.spotlight[data-slug="${alvo}"] .spotlight-media`]]) {
    const { page, ctx, erros } = await abrir('/', { ...opts, antes });
    await page.locator('#destaques').scrollIntoViewIfNeeded();
    const flag = page.locator(`${sel} [data-ultimos]`);
    await flag.waitFor({ timeout: 5000 });
    const [f, c] = [await flag.boundingBox(), await page.locator(sel).boundingBox()];
    assert(f.x >= c.x && f.x + f.width <= c.x + c.width && f.y >= c.y && f.y - c.y < 30, `${nome}: etiqueta fora do topo do flyer`);
    assert((await flag.textContent()).trim().toUpperCase() === 'ÚLTIMOS INGRESSOS', `${nome}: texto errado`);
    const cor = await flag.evaluate(el => getComputedStyle(el).textTransform);
    assert(cor === 'uppercase', 'etiqueta deveria estar em maiúsculas');
    // card gerado no navegador (busca da home)
    await page.locator('#agenda input[type=search]').fill(EVENTOS.find(e => e.slug === alvo).nome);
    const card = page.locator(`[data-resultados] .card[data-slug="${alvo}"]`);
    await card.waitFor({ timeout: 5000 });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700); // espera a entrada suave do card terminar
    const cf = await card.locator('[data-ultimos]').boundingBox(), cc = await card.boundingBox();
    const data = await card.locator('.card-date').boundingBox();
    assert(Math.abs(cf.y - cc.y) < 2 && Math.abs(cf.width - cc.width) < 3, `${nome}: faixa do card fora do topo ${JSON.stringify([cf, cc])}`);
    assert(data.y >= cf.y + cf.height, `${nome}: selo de data por baixo da etiqueta`);
    const corte = await card.locator('[data-ultimos]').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    assert(!corte, `${nome}: texto da etiqueta cortado`);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(sw <= (opts.viewport?.width || 1280), `${nome}: rolagem horizontal`);
    assert(!erros.length, erros.join(' | '));
    await ctx.close();
  }
});

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
  await page.locator(`#agenda .chip[data-cat=${CAT}]`).click();
  assert(await page.locator('[data-prateleiras]').isHidden(), 'prateleiras continuam');
  const n = await page.locator('[data-resultados] .card').count();
  assert(n === ativos.filter(e => e.categorias.includes(CAT)).length, 'contagem errada ' + n);
  await page.locator('#agenda .chip[data-cat=""]').click();
  assert(await page.locator('[data-prateleiras]').isVisible(), 'prateleiras não voltaram');
  await ctx.close();
});
await teste('setas da prateleira rolam os cards', async () => {
  const { page, ctx } = await abrir('/');
  const row = page.locator('.shelf').first().locator('.shelf-row');
  await row.scrollIntoViewIfNeeded();
  // com poucos eventos todos cabem na tela e as setas ficam escondidas: nada para rolar
  if (await page.locator('.shelf').first().locator('.shelf-arrows').isHidden()) { await ctx.close(); return; }
  await page.locator('.shelf').first().locator('button[data-dir="1"]').click();
  await page.waitForTimeout(700);
  // rola pelo menos 50px, ou até o fim quando sobra pouco para rolar
  assert(await row.evaluate(r => r.scrollLeft >= Math.min(50, r.scrollWidth - r.clientWidth - 2)), 'não rolou');
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
  const { page, ctx } = await abrir(`/agenda/?categoria=${CAT}`);
  await page.locator('[data-resultados] .card-link').first().click();
  await page.waitForURL('**/eventos/**');
  await page.goBack();
  await page.waitForURL(`**/agenda/?categoria=${CAT}`);
  assert(await page.locator(`.chip[data-cat=${CAT}]`).getAttribute('aria-pressed') === 'true', 'filtro perdido');
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

console.log('\nCelular: carrossel de destaques e filtros compactos');
const CEL = { viewport: { width: 390, height: 844 } };
const comLink = ativos.filter(e => e.compra && !['esgotado', 'cancelado'].includes(estadoEvento(e, hoje)));
await teste('carrossel: só flyers, cada um com o link de compra oficial do evento', async () => {
  const { page, ctx, erros } = await abrir('/', CEL);
  await page.locator('[data-carrossel]').scrollIntoViewIfNeeded();
  assert(await page.locator('[data-carrossel]').isVisible(), 'carrossel não aparece no celular');
  assert(!(await page.locator('#destaques .spotlight').isVisible()), 'destaque grande deveria dar lugar ao carrossel');
  const slides = await page.locator('.mcar-slide').evaluateAll(as => as.map(a => ({ slug: a.dataset.slug, href: a.getAttribute('href'), alvo: a.target, texto: [...a.childNodes].filter(n => !(n.dataset && 'ultimos' in n.dataset)).map(n => n.textContent).join('').trim(), img: !!a.querySelector('img') })));
  assert(slides.length === Math.min(4, comLink.filter(e => fs.existsSync(path.join(RAIZ, (e.flyer || `assets/events/${e.slug}.jpg`).replace(/^\//, '')))).length), `esperava 4 destaques, achou ${slides.length}`);
  for (const s of slides) {
    const ev = EVENTOS.find(e => e.slug === s.slug);
    assert(ev && s.href === ev.compra.url, `${s.slug}: link ${s.href} diferente do cadastrado`);
    assert(s.alvo === '_blank' && s.img && !s.texto, `${s.slug}: slide deve ser só imagem e abrir em nova aba`);
  }
  // passa por todos os slides e confere que as imagens carregaram
  const n = slides.length;
  for (let i = 0; i < n; i++) {
    await page.locator('.mcar-dots button').nth(i).click();
    await page.waitForTimeout(450);
  }
  await page.waitForLoadState('networkidle');
  const quebradas = await page.locator('.mcar-slide img').evaluateAll(is => is.filter(i => !i.complete || !i.naturalWidth).map(i => i.alt));
  assert(!quebradas.length, 'imagens quebradas: ' + quebradas);
  const proporcao = await page.locator('.mcar-slide').first().evaluate(a => a.getBoundingClientRect().height / a.getBoundingClientRect().width);
  assert(Math.abs(proporcao - 1.25) < 0.02, 'slide fora da proporção 4:5: ' + proporcao);
  const raio = await page.locator('.mcar-slide').first().evaluate(a => parseFloat(getComputedStyle(a).borderTopLeftRadius));
  assert(raio >= 12, 'slide sem cantos arredondados');
  assert(!erros.length, erros.join(' | '));
  await ctx.close();
});
await teste('carrossel: troca sozinho e o indicador acompanha', async () => {
  const { page, ctx } = await abrir('/', CEL);
  await page.locator('[data-carrossel]').scrollIntoViewIfNeeded();
  const ativo = () => page.locator('.mcar-dots button').evaluateAll(bs => bs.findIndex(b => b.getAttribute('aria-current') === 'true'));
  const antes = await ativo();
  await page.waitForTimeout(5600);
  const depois = await ativo();
  assert(depois === (antes + 1) % (await page.locator('.mcar-slide').count()), `não girou (${antes} → ${depois})`);
  const naTela = await page.locator('[data-trilho]').evaluate(t => { const s = t.children; return Math.round(t.scrollLeft / (s[1].offsetLeft - s[0].offsetLeft)); });
  assert(naTela === depois, `indicador ${depois} mas slide na tela ${naTela}`);
  await ctx.close();
});
await teste('carrossel: parado com "reduzir movimento"', async () => {
  const { page, ctx } = await abrir('/', { ...CEL, reducedMotion: 'reduce' });
  await page.locator('[data-carrossel]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(5600);
  assert(await page.locator('[data-trilho]').evaluate(t => t.scrollLeft) === 0, 'girou com reduzir movimento');
  await ctx.close();
});
for (const url of ['/', '/agenda/']) {
  await teste(`${url} celular: só "Todos os eventos", Carva e Praia; filtros funcionam`, async () => {
    const { page, ctx, erros } = await abrir(url, CEL);
    const visiveis = async () => (await page.locator('.chips .chip:visible').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    const v = await visiveis();
    assert(v.length === 3 && v[0].startsWith('Todos os eventos') && v[1] === 'Carva' && v[2] === 'Praia', 'chips no celular: ' + v.join(' | '));
    const total = ativos.length;
    for (const [rotulo, cat] of [['Carva', 'carvalheira'], ['Praia', 'praia']]) {
      await page.locator('.chips .chip:visible', { hasText: rotulo }).click();
      await page.waitForTimeout(150);
      const slugs = await page.locator('[data-resultados] .card').evaluateAll(cs => cs.map(c => c.dataset.slug));
      const esperado = ativos.filter(e => e.categorias.includes(cat)).map(e => e.slug).sort();
      assert(JSON.stringify([...slugs].sort()) === JSON.stringify(esperado), `${rotulo}: ${slugs} ≠ ${esperado}`);
      assert(await page.locator(`.chip[data-cat="${cat}"]`).getAttribute('aria-pressed') === 'true', `${rotulo} não ficou marcado`);
    }
    await page.locator('.chips .chip-todos').click();
    await page.waitForTimeout(150);
    if (url === '/') assert(await page.locator('[data-prateleiras]').isVisible(), 'Todos não restaurou as fileiras da home');
    else assert((await page.locator('[data-resultados] .card').count()) === total, 'Todos não restaurou a lista completa');
    assert(await page.locator('.chip-todos').getAttribute('aria-pressed') === 'true', 'Todos não ficou marcado');
    assert(!erros.length, erros.join(' | '));
    await ctx.close();
  });
}
for (const [w, h] of [[1280, 900], [390, 844]]) {
  await teste(`home ${w}px: uma fileira só ("Próximos eventos") que gira sozinha`, async () => {
    const { page, ctx } = await abrir('/', { viewport: { width: w, height: h } });
    assert(await page.locator('[data-prateleiras] .shelf').count() === 1, 'deveria ter só uma fileira');
    const row = page.locator('[data-rotativo] .shelf-row');
    assert(await row.locator('.card').count() === ativos.length, 'fileira deveria ter todos os eventos à venda');
    await row.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const antes = await row.evaluate(r => r.scrollLeft);
    await page.waitForTimeout(4800);
    assert(await row.evaluate(r => r.scrollLeft) > antes, 'não girou');
    await ctx.close();
  });
}
for (const largura of [1280, 1024, 768]) {
  await teste(`${largura}px: sem carrossel, destaque e filtros como antes`, async () => {
    const { page, ctx } = await abrir('/', { viewport: { width: largura, height: 900 } });
    await page.locator('#destaques').scrollIntoViewIfNeeded();
    assert(!(await page.locator('[data-carrossel]').isVisible()), 'carrossel apareceu no computador/tablet');
    assert(await page.locator('#destaques .spotlight').isVisible(), 'destaque sumiu');
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(600);
    const baixadas = await page.locator('.mcar-slide img').evaluateAll(is => is.filter(i => i.currentSrc && !i.currentSrc.startsWith('data:')).length);
    assert(!baixadas, `${baixadas} imagens do carrossel baixadas fora do celular`);
    const v = (await page.locator('.chips .chip:visible').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    assert(v.length === (await page.locator('.chips .chip').count()) && /^Todos \d+$/.test(v[0]) && v.some(t => t.startsWith('Carvalheira')), 'chips mudaram: ' + v.join(' | '));
    await ctx.close();
  });
}

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
