/* Gera o site estático a partir de data/eventos.js.
   Uso: npm run build   (ou: node scripts/build.mjs)
   Gera: index.html, agenda/index.html, eventos/<slug>/index.html,
         404.html, sitemap.xml, robots.txt, site.webmanifest
   Sem dependências: só Node 18+. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTOS, CATEGORIAS, SITE } from '../data/eventos.js';
import {
  esc, urlSegura, hojeRecife, dataPorExtenso, diasDaSemana, estadoEvento, ROTULO_ESTADO, acaoCompra,
  proximaData, nomeCategoria, artistas, pictureHTML, cardHTML, botaoCompraHTML, dataCurta,
} from '../js/render.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOJE = process.env.TX_HOJE || hojeRecife();
const ANO = HOJE.slice(0, 4);
const arq = p => path.join(RAIZ, p);
const existe = p => fs.existsSync(arq(p.replace(/^\//, '')));
const escrever = (p, conteudo) => {
  fs.mkdirSync(path.dirname(arq(p)), { recursive: true });
  fs.writeFileSync(arq(p), conteudo);
};

/* ------------------------------------------------------------------ */
/* 1. VALIDAÇÃO DOS DADOS: o build para se algo estiver errado          */
/* ------------------------------------------------------------------ */
const erros = [], avisos = [];
const slugs = new Set();
const catIds = new Set(CATEGORIAS.map(c => c.id));
for (const [i, ev] of EVENTOS.entries()) {
  const q = `evento ${i + 1} (${ev.slug || ev.nome || '?'})`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ev.slug || '')) erros.push(`${q}: slug inválido. Use só minúsculas, números e hífen.`);
  if (slugs.has(ev.slug)) erros.push(`${q}: slug repetido.`);
  slugs.add(ev.slug);
  if (!ev.nome) erros.push(`${q}: falta o nome.`);
  if (!Array.isArray(ev.datas) || !ev.datas.length) erros.push(`${q}: falta "datas".`);
  else {
    for (const d of ev.datas) {
      const ok = /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T12:00:00Z')) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
      if (!ok) erros.push(`${q}: data inválida "${d}". Use AAAA-MM-DD.`);
    }
    if ([...ev.datas].sort().join() !== ev.datas.join()) erros.push(`${q}: as datas precisam estar em ordem.`);
  }
  if (ev.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(ev.hora)) erros.push(`${q}: hora inválida "${ev.hora}". Use HH:MM.`);
  if (!ev.local) erros.push(`${q}: falta o local.`);
  if (!ev.cidade) erros.push(`${q}: falta a cidade.`);
  if (!Array.isArray(ev.categorias) || !ev.categorias.length) erros.push(`${q}: falta "categorias".`);
  else for (const c of ev.categorias) if (!catIds.has(c)) erros.push(`${q}: categoria "${c}" não existe em CATEGORIAS.`);
  if (ev.compra) {
    if (!['desconto', 'whatsapp', 'link'].includes(ev.compra.tipo)) erros.push(`${q}: compra.tipo deve ser desconto, whatsapp ou link.`);
    if (!urlSegura(ev.compra.url)) erros.push(`${q}: link de compra inválido.`);
    if (ev.compra.tipo === 'whatsapp' && !/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(ev.compra.url)) erros.push(`${q}: compra do tipo whatsapp precisa de link wa.me ou api.whatsapp.com.`);
  } else avisos.push(`${q}: sem link de compra (vai aparecer "Em breve").`);
  if (ev.status && !['esgotado', 'cancelado', 'adiado'].includes(ev.status)) erros.push(`${q}: status "${ev.status}" inválido.`);
  if (ev.ingressos) for (const t of ev.ingressos) {
    if (!t.setor) erros.push(`${q}: ingresso sem setor.`);
    if (t.preco != null && !(typeof t.preco === 'number' && t.preco >= 0)) erros.push(`${q}: preço do ingresso "${t.setor}" precisa ser número (ex.: 120 ou 89.9).`);
  }
  if (!existe(`assets/events/${ev.slug}.jpg`)) avisos.push(`${q}: flyer assets/events/${ev.slug}.jpg não encontrado (o card mostra o nome no lugar).`);
}
if (erros.length) {
  console.error('\n✖ Corrija antes de publicar:\n  - ' + erros.join('\n  - ') + '\n');
  process.exit(1);
}

/* imagens: usa as versões otimizadas quando existem */
for (const ev of EVENTOS) {
  const base = `assets/events/${ev.slug}.jpg`;
  if (!existe(base)) { ev.img = null; continue; }
  const webp = [480, 640, 960].filter(w => existe(`assets/events/opt/${ev.slug}-${w}.webp`)).map(w => [`/assets/events/opt/${ev.slug}-${w}.webp`, w]);
  const jpg = existe(`assets/events/opt/${ev.slug}-960.jpg`) ? `/assets/events/opt/${ev.slug}-960.jpg` : `/${base}`;
  const dim = jpegSize(arq(jpg.slice(1)));
  ev.img = { webp, jpg, w: dim.w, h: dim.h };
  ev.og = existe(`assets/og/${ev.slug}.jpg`) ? `/assets/og/${ev.slug}.jpg` : '/assets/brand/og-share.jpg';
}
function jpegSize(file) {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return { w: 960, h: 1200 };
}

/* ordenações úteis */
const estado = ev => estadoEvento(ev, HOJE);
const ativos = EVENTOS.filter(ev => !['encerrado', 'cancelado'].includes(estado(ev)))
  .sort((a, b) => proximaData(a, HOJE).localeCompare(proximaData(b, HOJE)));
const passados = EVENTOS.filter(ev => ['encerrado', 'cancelado'].includes(estado(ev)))
  .sort((a, b) => b.datas[b.datas.length - 1].localeCompare(a.datas[a.datas.length - 1]));
const fixadosPrimeiro = lista => [...lista].sort((a, b) => (b.destaque === true) - (a.destaque === true));
const ctx = { hoje: HOJE, categorias: CATEGORIAS };

/* ------------------------------------------------------------------ */
/* 2. PEÇAS COMUNS                                                     */
/* ------------------------------------------------------------------ */
const I = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1 1"/><path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1-1"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.06-1.33A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.2 14.2c-.22.62-1.29 1.19-1.78 1.24-.46.05-.9.23-3.02-.63-2.56-1.05-4.2-3.66-4.33-3.83-.13-.17-1.03-1.37-1.03-2.61 0-1.24.65-1.85.88-2.1.22-.25.5-.3.66-.3.17 0 .33 0 .48.01.15.01.36-.06.56.43.22.53.74 1.83.8 1.96.06.13.1.28.02.45-.08.17-.13.28-.25.43-.13.15-.27.34-.38.46-.13.13-.26.27-.11.53.15.26.67 1.1 1.43 1.78.98.88 1.81 1.15 2.07 1.28.26.13.41.11.56-.07.15-.17.65-.75.82-1.01.17-.26.34-.21.56-.13.22.08 1.42.67 1.66.79.24.12.4.18.46.28.06.11.06.62-.16 1.24z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
};
const EXT = 'target="_blank" rel="noopener noreferrer"';
const NOVA_ABA = '<span class="sr-only"> (abre em nova aba)</span>';

/* script do <head>: decide se mostra a abertura e trata imagens quebradas desde o início */
const HEAD_JS = `(function(d){var h=d.documentElement;h.classList.add('js');try{if(sessionStorage.getItem('tx-intro'))h.classList.add('no-intro')}catch(e){}d.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG'){var p=t.closest('[data-fallback]');if(p)p.classList.add('img-failed');else t.style.visibility='hidden'}},true)})(document);`;

function layout({ title, description, canonical, og = '/assets/brand/og-share.jpg', ogAlt = 'TicketX: ingressos das melhores festas de Pernambuco', current = '', main, bodyClass = '', headExtra = '', jsonld = [], scripts = ['/js/site.js'], noindex = false, preload = '' }) {
  const abs = u => SITE.url + u;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(abs(canonical))}">`}
<meta name="theme-color" content="#07040f">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TicketX">
<meta property="og:locale" content="pt_BR">
${noindex ? '' : `<meta property="og:url" content="${esc(abs(canonical))}">`}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(abs(og))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(abs(og))}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/poppins-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/poppins-800.woff2" as="font" type="font/woff2" crossorigin>
${preload}
<link rel="stylesheet" href="/css/site.css">
<script>${HEAD_JS}</script>
${headExtra}
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body class="${bodyClass}">
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
${intro()}
${header(current)}
<main id="conteudo" tabindex="-1">
${main}
</main>
${footer()}
<a class="fab" href="${esc(SITE.ajuda)}" ${EXT} aria-label="Falar com a TicketX no WhatsApp (abre em nova aba)">${I.wa}<span>Ajuda</span></a>
<div class="toast" role="status" aria-live="polite"></div>
${scripts.map(s => `<script type="module" src="${s}"></script>`).join('\n')}
</body>
</html>
`;
}

function intro() {
  return `<div class="intro" aria-hidden="true">
  <div class="intro-inner">
    <img class="intro-mark" src="/assets/brand/icon-192.png" alt="" width="72" height="72">
    <img class="intro-logo" src="/assets/brand/logo.webp" alt="" width="150" height="28">
    <div class="intro-track"><div class="intro-fill indeterminate"></div></div>
    <div class="intro-status">Carregando</div>
  </div>
</div>`;
}

const NAV = [
  ['/', 'Início', 'inicio'],
  ['/agenda/', 'Agenda', 'agenda'],
  ['/#destaques', 'Destaques', 'destaques'],
  ['/#duvidas', 'Dúvidas', 'duvidas'],
];
function header(current) {
  const links = NAV.map(([href, txt, id]) => `<a href="${href}"${current === id ? ' aria-current="page"' : ''}>${txt}</a>`).join('');
  return `<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="/" aria-label="TicketX, página inicial"><img src="/assets/brand/logo.webp" alt="TicketX" width="127" height="24"></a>
    <nav class="nav-links" aria-label="Principal">${links}</nav>
    <a class="btn btn-vip" href="${esc(SITE.grupoVip)}" ${EXT}>Grupo VIP${NOVA_ABA}</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu" aria-label="Abrir menu">${I.menu}</button>
  </div>
</header>
<div class="drawer" id="menu" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="drawer-backdrop" data-close-menu></div>
  <div class="drawer-panel">
    <div class="drawer-top">
      <img src="/assets/brand/logo.webp" alt="TicketX" width="117" height="22">
      <button class="icon-btn" type="button" data-close-menu aria-label="Fechar menu">${I.close}</button>
    </div>
    <nav aria-label="Menu">${links}<a href="/#vip">Grupo VIP</a></nav>
    <a class="btn btn-vip" href="${esc(SITE.grupoVip)}" ${EXT}>Entrar no Grupo VIP${NOVA_ABA}</a>
    <a class="btn btn-ghost" href="${esc(SITE.instagram)}" ${EXT}>${I.ig} ${esc(SITE.instagramUser)}${NOVA_ABA}</a>
    <p class="drawer-note">Dúvidas? Fale com a gente pelo <a class="link" href="${esc(SITE.ajuda)}" ${EXT}>WhatsApp${NOVA_ABA}</a>.</p>
  </div>
</div>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="/assets/brand/logo.webp" alt="TicketX" width="127" height="24" loading="lazy">
        <p>Seus ingressos, experiências e próximos eventos em Pernambuco em um só lugar.</p>
      </div>
      <div class="footer-col">
        <h2>Navegue</h2>
        <ul role="list"><li><a href="/">Início</a></li><li><a href="/agenda/">Agenda completa</a></li><li><a href="/#destaques">Destaques</a></li><li><a href="/#duvidas">Dúvidas frequentes</a></li></ul>
      </div>
      <div class="footer-col">
        <h2>Categorias</h2>
        <ul role="list">${CATEGORIAS.filter(c => EVENTOS.some(e => e.categorias.includes(c.id))).map(c => `<li><a href="/agenda/?categoria=${c.id}">${esc(c.nome)}</a></li>`).join('')}</ul>
      </div>
      <div class="footer-col">
        <h2>Contato</h2>
        <ul role="list">
          <li><a href="${esc(SITE.ajuda)}" ${EXT}>WhatsApp de ajuda${NOVA_ABA}</a></li>
          <li><a href="${esc(SITE.grupoVip)}" ${EXT}>Grupo VIP${NOVA_ABA}</a></li>
          <li><a href="${esc(SITE.instagram)}" ${EXT}>Instagram ${esc(SITE.instagramUser)}${NOVA_ABA}</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <span data-ano>${ANO}</span> TicketX. Todos os direitos reservados.</span>
      <span class="footer-note">A TicketX divulga eventos e direciona para a compra oficial. Os pagamentos são feitos na plataforma de venda de cada evento ou combinados com a equipe pelo WhatsApp.</span>
      <span>Feito pela results.ag</span>
    </div>
  </div>
</footer>`;
}

/* dados enviados ao navegador para busca e filtros (só o necessário) */
function dadosCliente() {
  const campos = ['slug', 'nome', 'datas', 'categorias', 'local', 'endereco', 'cidade', 'compra', 'status', 'destaque', 'lineup', 'descricao', 'img'];
  const evs = EVENTOS.map(ev => Object.fromEntries(campos.filter(c => ev[c] != null).map(c => [c, ev[c]])));
  return `<script type="application/json" id="tx-dados">${JSON.stringify({ hojeBuild: HOJE, categorias: CATEGORIAS, eventos: evs }).replace(/</g, '\\u003c')}</script>`;
}

/* barra de filtros (home e agenda) */
function filtrosHTML(modo) {
  const comAtivos = CATEGORIAS.filter(c => ativos.some(e => e.categorias.includes(c.id)));
  const cidades = [...new Set(ativos.map(e => e.cidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const chips = [`<button type="button" class="chip" data-cat="" aria-pressed="true">Todos <small>${ativos.length}</small></button>`]
    .concat(comAtivos.map(c => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="false">${esc(c.nome)} <small>${ativos.filter(e => e.categorias.includes(c.id)).length}</small></button>`));
  return `<form class="filters" role="search" data-filtros="${modo}" onsubmit="return false">
  <div class="filters-row">
    <div class="search">${I.search}<label class="sr-only" for="busca-${modo}">Buscar evento, artista, cidade ou local</label><input id="busca-${modo}" type="search" name="q" placeholder="Buscar festa, artista ou cidade" autocomplete="off" enterkeyhint="search"></div>
    <div class="select"><label class="sr-only" for="cidade-${modo}">Cidade</label><select id="cidade-${modo}" name="cidade"><option value="">Cidade: todas</option>${cidades.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
    <div class="select"><label class="sr-only" for="ordem-${modo}">Ordenar</label><select id="ordem-${modo}" name="ordem"><option value="asc">Mais próximos</option><option value="desc">Mais distantes</option></select></div>
  </div>
  <div class="chips" role="group" aria-label="Filtrar por categoria">${chips.join('')}</div>
</form>`;
}

function prateleira(id, titulo, lista, { sub = '' } = {}) {
  if (!lista.length) return '';
  return `<section class="shelf" aria-labelledby="sh-${id}">
  <div class="shelf-head">
    <h3 id="sh-${id}">${esc(titulo)}${sub ? ` <small>${esc(sub)}</small>` : ''}</h3>
    <div class="shelf-arrows"><button type="button" data-dir="-1" aria-label="Ver eventos anteriores em ${esc(titulo)}">${I.left}</button><button type="button" data-dir="1" aria-label="Ver próximos eventos em ${esc(titulo)}">${I.right}</button></div>
  </div>
  <div class="shelf-row" tabindex="0" aria-label="${esc(titulo)}: role para ver mais">${lista.map(e => cardHTML(e, ctx)).join('')}</div>
</section>`;
}
function prateleirasHome() {
  const out = [prateleira('proximos', 'Próximos eventos', ativos, { sub: `${ativos.length} na agenda` })];
  for (const c of CATEGORIAS) {
    // só categorias com 3+ eventos ganham fileira própria (as demais ficam nos filtros)
    const l = ativos.filter(e => e.categorias.includes(c.id));
    if (l.length >= 3) out.push(prateleira(c.id, c.nome, fixadosPrimeiro(l)));
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* 3. HOME                                                             */
/* ------------------------------------------------------------------ */
function home() {
  const fixados = ativos.filter(e => e.destaque);
  const principal = fixados[0] || ativos[0];
  const proximos = ativos.filter(e => e !== principal).slice(0, 3);
  const arte = [principal, ...proximos].filter(e => e && e.img).slice(0, 3);
  const blank = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  const arteHTML = arte.map((e, i) => `<a href="/eventos/${e.slug}/" aria-label="${esc(e.nome)}"${i ? ' tabindex="-1"' : ''}><picture><source media="(max-width:1024px)" srcset="${blank}"><source type="image/webp" srcset="${e.img.webp.map(([u, w]) => `${u} ${w}w`).join(', ')}" sizes="300px"><img src="${e.img.jpg}" alt="" width="${e.img.w}" height="${e.img.h}" ${i === 0 ? 'fetchpriority="high"' : ''} data-critical decoding="async"></picture></a>`).join('');

  const spot = principal ? (() => {
    const st = estado(principal), a = acaoCompra(principal, st);
    return `<article class="spotlight">
      <a class="spotlight-media" href="/eventos/${principal.slug}/" tabindex="-1" aria-hidden="true" data-fallback="${esc(principal.nome)}">${pictureHTML(principal, { sizes: '(max-width:860px) 100vw, 340px', alt: '' })}</a>
      <div class="spotlight-body">
        <div class="ev-tags">${principal.destaque ? '<span class="tag" style="color:#ffd76a;border-color:rgba(255,197,66,.45)">★ Destaque TicketX</span>' : '<span class="tag">Próximo evento</span>'}${a.selo ? `<span class="tag ${a.tipo === 'desconto' ? 'tag-offer' : 'tag-free'}">${esc(a.selo)}</span>` : ''}</div>
        <h3><a href="/eventos/${principal.slug}/">${esc(principal.nome)}</a></h3>
        <div class="spotlight-facts"><span>${I.cal}${esc(dataPorExtenso(principal.datas))}</span><span>${I.pin}${esc(principal.local)} · ${esc(principal.cidade)}</span></div>
        ${principal.lineup ? `<p class="lead">${esc(artistas(principal).slice(0, 6).join(', '))}${artistas(principal).length > 6 ? ' e mais' : ''}</p>` : ''}
        <div class="spotlight-actions">${botaoCompraHTML(principal, st, { classe: '' })}<a class="btn btn-ghost" href="/eventos/${principal.slug}/">Ver detalhes</a></div>
        <p class="spotlight-hint">${esc(a.dica)}</p>
      </div>
    </article>` })() : '';
  const proxHTML = proximos.length ? `<div class="next-list">${proximos.map(e => `<a class="next-item" href="/eventos/${e.slug}/">${e.img ? `<span class="next-thumb" data-fallback="">${pictureHTML(e, { sizes: '64px', alt: '' })}</span>` : '<span class="next-thumb"></span>'}<div><b>${esc(e.nome)}</b><span>${esc(dataCurta(proximaData(e, HOJE)))} · ${esc(e.cidade)}</span></div></a>`).join('')}</div>` : '';

  const faq = [
    ['Como compro um ingresso?', `Abra a página do evento e toque no botão de compra. Nos eventos com <strong>link de desconto</strong>, você vai para a plataforma de venda (como a Sympla) pelo link parceiro da TicketX. Nos eventos com <strong>vendas sem taxa</strong>, abre uma conversa no WhatsApp da TicketX com o nome da festa já escrito.`],
    ['O pagamento é feito no site da TicketX?', 'Não. Este site não processa pagamentos nem pede dados de cartão. A compra acontece na plataforma de venda oficial do evento ou é combinada com a equipe da TicketX pelo WhatsApp.'],
    ['Como funcionam os links com desconto?', 'Quando o evento mostra um selo como “Link com 5% OFF”, o desconto é aplicado pela plataforma de venda ao usar o link da TicketX. Confira sempre o valor final na tela de pagamento antes de concluir.'],
    ['O que significa “vendas sem taxa”?', 'Nesses eventos a compra é feita direto com a equipe da TicketX pelo WhatsApp, sem taxa de serviço.'],
    ['Todos os eventos têm link da TicketX?', 'Não. Eventos sem link de compra aparecem como “Em breve” até que uma opção seja disponibilizada.'],
    ['Onde acompanho as novidades?', `No Instagram oficial <a href="${esc(SITE.instagram)}" ${EXT}>${esc(SITE.instagramUser)}${NOVA_ABA}</a> e no <a href="${esc(SITE.grupoVip)}" ${EXT}>Grupo VIP${NOVA_ABA}</a>, onde saem primeiro os avisos de novos eventos e links promocionais.`],
  ];

  const main = `
<section class="hero" id="inicio" aria-labelledby="hero-title">
  <div class="wrap hero-grid">
    <div>
      <span class="hero-tag"><i aria-hidden="true"></i>${ativos.length} ${ativos.length === 1 ? 'evento' : 'eventos'} na agenda</span>
      <h1 id="hero-title">Conectando você às <em>melhores experiências</em></h1>
      <p>Descubra as festas que vão marcar sua próxima experiência em Pernambuco, escolha seu evento e garanta seu ingresso de forma rápida e sem complicação.</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="#agenda">Ver eventos</a>
        <a class="btn btn-vip btn-lg" href="${esc(SITE.grupoVip)}" ${EXT}>Entrar no Grupo VIP${NOVA_ABA}</a>
      </div>
      <nav class="hero-quick" aria-label="Categorias">${CATEGORIAS.filter(c => ativos.some(e => e.categorias.includes(c.id))).map(c => `<a href="/agenda/?categoria=${c.id}">${esc(c.nome)}</a>`).join('')}</nav>
    </div>
    <div class="hero-art">${arteHTML}</div>
  </div>
</section>

<div class="promo" aria-hidden="true"><div class="promo-track">${'<span>Use o Grupo <b>VIP</b> TicketX e ganhe desconto nas melhores festas</span>'.repeat(6)}</div></div>

<section class="section" id="destaques" aria-labelledby="destaques-title">
  <div class="wrap">
    <div class="section-head"><div><span class="kicker">Destaques</span><h2 class="h2" id="destaques-title">Não fique de fora</h2></div></div>
    ${spot}
    ${proxHTML}
  </div>
</section>

<section class="section" id="agenda" aria-labelledby="agenda-title" style="padding-top:0">
  <div class="wrap" data-agenda="home">
    <div class="section-head"><div><span class="kicker">Agenda TicketX</span><h2 class="h2" id="agenda-title">Festas disponíveis</h2><p class="lead">Busque pelo nome da festa, artista ou cidade, ou role pelas categorias.</p></div><a class="btn btn-ghost" href="/agenda/">Agenda completa</a></div>
    ${filtrosHTML('home')}
    <p class="results-bar" data-contagem aria-live="polite" hidden></p>
    <div data-prateleiras>${prateleirasHome()}</div>
    <div class="grid-cards" data-resultados hidden></div>
    <div data-vazio hidden></div>
  </div>
</section>

<section class="section-tight" id="vantagens" aria-labelledby="vantagens-title">
  <div class="wrap">
    <div class="section-head"><div><span class="kicker">Por que TicketX?</span><h2 class="h2" id="vantagens-title">Mais praticidade para curtir</h2></div><p class="lead">Uma experiência pensada para deixar a busca pelo seu próximo evento mais simples.</p></div>
    <div class="perks">
      <div class="perk"><span class="perk-n">01</span><h3>Eventos selecionados</h3><p>Encontre em um só lugar as festas e experiências que fazem parte da nossa agenda.</p></div>
      <div class="perk"><span class="perk-n">02</span><h3>Compra rápida</h3><p>Cada evento leva direto ao link de compra oficial ou ao nosso WhatsApp, com a festa já identificada.</p></div>
      <div class="perk"><span class="perk-n">03</span><h3>Benefícios exclusivos</h3><p>Quando há parceria, mostramos com clareza o link com desconto disponível.</p></div>
      <div class="perk"><span class="perk-n">04</span><h3>Atendimento de verdade</h3><p>Ficou com dúvida? Fale com a equipe da TicketX pelo WhatsApp.</p></div>
    </div>
  </div>
</section>

<section class="section" id="vip" aria-labelledby="vip-title">
  <div class="wrap">
    <div class="vip">
      <div>
        <span class="kicker" style="color:#d9c7ff">Comunidade TicketX</span>
        <h2 id="vip-title">Entre para o Grupo VIP TicketX</h2>
        <p>Receba primeiro os melhores eventos, descontos exclusivos, links promocionais e oportunidades especiais.</p>
        <a class="btn btn-vip btn-lg" href="${esc(SITE.grupoVip)}" ${EXT}>Entrar no Grupo VIP${NOVA_ABA}</a>
      </div>
      <ul>${['Descontos exclusivos', 'Pré-vendas', 'Links promocionais', 'Avisos de novos eventos', 'Condições especiais'].map(t => `<li>${I.check}${t}</li>`).join('')}</ul>
    </div>
  </div>
</section>

<section class="section-tight" id="instagram" aria-labelledby="ig-title">
  <div class="wrap">
    <div class="insta">
      <div class="insta-logo">${I.ig}</div>
      <div><h2 id="ig-title">Fique por dentro no Instagram</h2><p>Ingressos, promoções e descontos das melhores festas em ${esc(SITE.instagramUser)}.</p></div>
      <a class="btn btn-ghost btn-lg" href="${esc(SITE.instagram)}" ${EXT}>Seguir ${esc(SITE.instagramUser)}${NOVA_ABA}</a>
    </div>
  </div>
</section>

<section class="section" id="duvidas" aria-labelledby="faq-title">
  <div class="wrap">
    <div class="section-head"><div><span class="kicker">FAQ</span><h2 class="h2" id="faq-title">Dúvidas frequentes</h2></div></div>
    <div class="faq">${faq.map(([q, a]) => `<details><summary>${q}</summary><div><p>${a}</p></div></details>`).join('')}</div>
    <p class="faq-more">Ainda com dúvida? <a href="${esc(SITE.ajuda)}" ${EXT}>Fale com a gente no WhatsApp${NOVA_ABA}</a>.</p>
  </div>
</section>`;

  const slugsJs = JSON.stringify(EVENTOS.map(e => e.slug));
  return layout({
    title: 'TicketX: ingressos das melhores festas de Pernambuco',
    description: 'Agenda de festas em Pernambuco: Carvalheira, vaquejadas, Réveillon e Carnaval. Compre sem taxa ou com link de desconto e entre no Grupo VIP.',
    canonical: '/',
    current: 'inicio',
    main,
    // links antigos ticketxco.com.br/#slug continuam funcionando
    headExtra: `<script>(function(){var s=decodeURIComponent(location.hash.slice(1));if(${slugsJs}.indexOf(s)>-1)location.replace('/eventos/'+s+'/')})();</script>\n${dadosCliente()}`,
    scripts: ['/js/site.js', '/js/agenda.js'],
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'Organization', name: 'TicketX', url: SITE.url + '/', logo: SITE.url + '/assets/brand/icon-512.png', sameAs: [SITE.instagram] },
      { '@context': 'https://schema.org', '@type': 'WebSite', name: 'TicketX', url: SITE.url + '/', inLanguage: 'pt-BR' },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* 4. AGENDA COMPLETA                                                  */
/* ------------------------------------------------------------------ */
function agenda() {
  const main = `
<div class="wrap">
  <nav class="crumbs" aria-label="Você está em"><ol><li><a href="/">Início</a></li><li><span aria-current="page">Agenda</span></li></ol></nav>
</div>
<section class="section" style="padding-top:28px" aria-labelledby="ag-title">
  <div class="wrap" data-agenda="agenda">
    <div class="section-head"><div><span class="kicker">Agenda TicketX</span><h1 class="h2" id="ag-title">Agenda de eventos</h1><p class="lead">Todas as festas da TicketX em Pernambuco, por data. Busque por evento, artista, cidade ou local.</p></div></div>
    ${filtrosHTML('agenda')}
    <p class="results-bar" data-contagem aria-live="polite"><span><strong>${ativos.length}</strong> ${ativos.length === 1 ? 'evento' : 'eventos'} na agenda</span></p>
    <h2 class="sr-only">Próximos eventos</h2>
    <div class="grid-cards" data-resultados>${ativos.map((e, i) => cardHTML(e, { ...ctx, eager: i < 2 })).join('')}</div>
    <div data-vazio hidden></div>
    <div class="past-block" data-passados${passados.length ? '' : ' hidden'}>
      <h2>Eventos encerrados</h2>
      <p>Histórico de festas que já aconteceram. As vendas desses eventos estão encerradas.</p>
      <div class="grid-cards" data-passados-lista>${passados.map(e => cardHTML(e, ctx)).join('')}</div>
    </div>
  </div>
</section>`;
  return layout({
    title: 'Agenda de eventos em Pernambuco | TicketX',
    description: `Agenda completa da TicketX com ${ativos.length} eventos: ${ativos.slice(0, 4).map(e => e.nome).join(', ')} e mais. Busque por artista, cidade ou categoria.`,
    canonical: '/agenda/',
    current: 'agenda',
    main,
    headExtra: dadosCliente(),
    scripts: ['/js/site.js', '/js/agenda.js'],
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: SITE.url + '/' },
        { '@type': 'ListItem', position: 2, name: 'Agenda', item: SITE.url + '/agenda/' },
      ],
    }],
  });
}

/* ------------------------------------------------------------------ */
/* 5. PÁGINA DE CADA EVENTO                                            */
/* ------------------------------------------------------------------ */
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function jsonLdEvento(ev, st) {
  // só gera dados estruturados com nome, data e local confirmados
  if (!ev.nome || !ev.datas?.length || !ev.local || !ev.cidade) return [];
  const status = { cancelado: 'https://schema.org/EventCancelled', adiado: 'https://schema.org/EventPostponed' }[st] || 'https://schema.org/EventScheduled';
  const local = {
    '@type': 'Place', name: ev.local,
    address: { '@type': 'PostalAddress', ...(ev.endereco ? { streetAddress: ev.endereco } : {}), addressLocality: ev.cidade, addressRegion: 'PE', addressCountry: 'BR' },
  };
  const a = acaoCompra(ev, st);
  const base = {
    '@context': 'https://schema.org', '@type': 'Event', name: ev.nome,
    eventStatus: status, eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: local, url: `${SITE.url}/eventos/${ev.slug}/`,
    ...(ev.img ? { image: [SITE.url + '/assets/events/' + ev.slug + '.jpg'] } : {}),
    description: descricaoEvento(ev),
    ...(artistas(ev).length ? { performer: artistas(ev).map(n => ({ '@type': 'PerformingGroup', name: n })) } : {}),
    ...(a.href && a.tipo !== 'whatsapp' ? { offers: { '@type': 'Offer', url: a.href } } : {}),
  };
  const dt = d => ev.hora ? `${d}T${ev.hora}:00-03:00` : d;
  // dias seguidos = um evento com início e fim; dias soltos = um evento por data
  const seguidos = ev.datas.every((d, i) => !i || (Date.parse(d) - Date.parse(ev.datas[i - 1]) === 86400000));
  if (seguidos) return [{ ...base, startDate: dt(ev.datas[0]), ...(ev.datas.length > 1 ? { endDate: ev.datas[ev.datas.length - 1] } : {}) }];
  return ev.datas.map(d => ({ ...base, startDate: dt(d) }));
}

function descricaoEvento(ev) {
  const a = artistas(ev);
  const partes = [`${ev.nome} em ${ev.local}, ${ev.cidade}: ${dataPorExtenso(ev.datas)}.`];
  if (a.length) partes.push(`Line-up: ${a.slice(0, 4).join(', ')}${a.length > 4 ? ' e mais' : ''}.`);
  const t = ev.compra?.tipo;
  if (t === 'desconto') partes.push(`Ingressos com link de ${ev.compra.desconto || 'desconto'} na TicketX.`);
  else if (t === 'whatsapp') partes.push('Ingressos sem taxa pela TicketX.');
  let s = partes.join(' ');
  if (s.length > 160) s = s.slice(0, 157).replace(/\s+\S*$/, '') + '...';
  return s;
}

function paginaEvento(ev) {
  const st = estado(ev);
  const a = acaoCompra(ev, st);
  const url = `/eventos/${ev.slug}/`;
  const abs = SITE.url + url;
  const quando = dataPorExtenso(ev.datas);
  const semana = diasDaSemana(ev.datas);
  const mapaQ = encodeURIComponent([ev.local, ev.endereco, ev.cidade, 'PE'].filter(Boolean).join(', '));
  const mapa = `https://www.google.com/maps/search/?api=1&query=${mapaQ}`;
  const textoShare = `${ev.nome} · ${quando} · ${ev.local}, ${ev.cidade}. Ingressos na TicketX: ${abs}`;
  const waShare = `https://wa.me/?text=${encodeURIComponent(textoShare)}`;
  const ajuda = `https://wa.me/${SITE.whatsappNumero}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o evento ${ev.nome}.`)}`;
  const cats = ev.categorias.map(c => `<a class="tag" href="/agenda/?categoria=${c}">${esc(nomeCategoria(c, CATEGORIAS))}</a>`).join('');
  const estadoTag = ROTULO_ESTADO[st] ? `<span class="tag tag-state s-${st}" data-estado-tag>${esc(ROTULO_ESTADO[st])}</span>` : '<span class="tag tag-state" data-estado-tag hidden></span>';
  const seloTag = a.selo ? `<span class="tag ${a.tipo === 'desconto' ? 'tag-offer' : 'tag-free'}" data-selo>${esc(a.selo)}</span>` : '';

  /* ingressos */
  let ingressos;
  if (ev.ingressos?.length) {
    ingressos = `<table class="tickets"><caption class="sr-only">Ingressos de ${esc(ev.nome)}</caption><thead><tr><th scope="col">Setor</th><th scope="col">Lote</th><th scope="col">Preço</th></tr></thead><tbody>${ev.ingressos.map(t => `<tr><td>${esc(t.setor)}${t.obs ? `<br><small style="color:var(--dim)">${esc(t.obs)}</small>` : ''}</td><td>${esc(t.lote || '—')}</td><td>${t.preco != null ? esc(brl(t.preco)) : 'Consulte'}</td></tr>`).join('')}</tbody></table>
      <p style="margin-top:12px;font-size:14px">Valores informados pela organização e sujeitos a mudança de lote. Confira o valor final antes de pagar.</p>`;
  } else {
    const msg = {
      desconto: `Setores, lotes e preços aparecem na ${esc(ev.compra?.plataforma || 'plataforma de venda')} ao abrir o link de compra. Pelo link da TicketX você compra com ${esc(ev.compra?.desconto || 'desconto')}, aplicado pela própria plataforma.`,
      whatsapp: 'Setores e valores são informados pela equipe da TicketX no WhatsApp. Vendas sem taxa.',
      link: `Setores, lotes e preços aparecem na página oficial de venda${ev.compra?.plataforma ? ' na ' + esc(ev.compra.plataforma) : ''}.`,
      'em-breve': 'Os ingressos ainda não foram disponibilizados pela TicketX. Entre no Grupo VIP para ser avisado quando abrir.',
      encerrado: 'As vendas deste evento estão encerradas.',
      cancelado: 'Este evento foi cancelado.',
      esgotado: 'Os ingressos deste evento esgotaram.',
    }[a.tipo];
    ingressos = `<div class="notice">${I.info}<p>${msg}</p></div>`;
  }

  /* informações */
  const info = [];
  if (ev.descricao) info.push(`<p>${esc(ev.descricao)}</p>`);
  if (ev.condicoes?.length) info.push(`<h3 class="sr-only">Condições</h3><ul class="list" role="list">${ev.condicoes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`);
  if (ev.classificacao) info.push(`<p><strong style="color:var(--text)">Classificação etária:</strong> ${esc(ev.classificacao)}</p>`);
  if (ev.regras?.length) info.push(`<h3 style="font-size:16px;margin:8px 0 2px">Regras de entrada</h3><ul class="list" role="list">${ev.regras.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`);

  /* line-up */
  let lineup = '';
  if (ev.lineup) {
    const lista = l => `<ul class="artists" role="list">${l.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
    lineup = Array.isArray(ev.lineup)
      ? lista(ev.lineup)
      : Object.entries(ev.lineup).map(([dia, l]) => `<div class="lineup-day"><h3>${esc(dia)}</h3>${lista(l)}</div>`).join('');
    if (ev.lineupNota) lineup += `<p class="lineup-note">${esc(ev.lineupNota)}</p>`;
  }

  /* perguntas do evento (só com dados reais) */
  const faq = [];
  if (a.href) faq.push([`Como compro o ingresso de ${ev.nome}?`, esc(a.dica)]);
  const ob = (ev.condicoes || []).find(c => /open bar/i.test(c));
  if (ob) faq.push(['O evento tem open bar?', esc(ob)]);
  if (ev.classificacao) faq.push(['Menores de idade podem entrar?', esc(ev.classificacao) + ((ev.regras || []).filter(r => /menor/i.test(r)).map(r => ' ' + esc(r)).join(''))]);
  else { const rm = (ev.regras || []).find(r => /menor/i.test(r)); if (rm) faq.push(['Menores de idade podem entrar?', esc(rm)]); }
  faq.push(['Tenho outra dúvida. Com quem falo?', `Fale com a equipe da TicketX pelo <a href="${esc(ajuda)}" ${EXT}>WhatsApp${NOVA_ABA}</a>, com o nome do evento já na mensagem.`]);

  /* relacionados */
  let rel = ativos.filter(e => e !== ev && (e.categorias.some(c => ev.categorias.includes(c)) || e.cidade === ev.cidade));
  if (rel.length < 4) rel = rel.concat(ativos.filter(e => e !== ev && !rel.includes(e))).slice(0, 6);
  rel = rel.slice(0, 6);

  const cliente = { slug: ev.slug, nome: ev.nome, datas: ev.datas, compra: ev.compra, status: ev.status, estadoBuild: st };
  const main = `
<div class="ev-hero">
  ${ev.img ? `<div class="ev-bg" style="background-image:url('${esc(ev.img.webp[0]?.[0] || ev.img.jpg)}')" aria-hidden="true"></div>` : ''}
  <div class="wrap">
    <nav class="crumbs" aria-label="Você está em"><ol><li><a href="/">Início</a></li><li><a href="/agenda/">Agenda</a></li><li><span aria-current="page">${esc(ev.nome)}</span></li></ol></nav>
    <div class="ev-grid" style="margin-top:20px">
      <div class="ev-poster" data-fallback="${esc(ev.nome)}">${ev.img ? pictureHTML(ev, { sizes: '(max-width:860px) 92vw, 440px', eager: true, alt: `Flyer oficial de ${ev.nome}` }) : ''}</div>
      <div class="ev-head">
        <div class="ev-tags">${estadoTag}${seloTag}${cats}</div>
        <h1>${esc(ev.nome)}</h1>
        <ul class="facts" role="list">
          <li><span class="ico">${I.cal}</span><div><b>${esc(quando)}</b><span>${esc(semana)}</span></div></li>
          ${ev.horario ? `<li><span class="ico">${I.clock}</span><div><b>${esc(ev.horario)}</b><span>Horário informado pela organização</span></div></li>` : ''}
          <li><span class="ico">${I.pin}</span><div><b>${esc(ev.local)}</b><span>${esc([ev.endereco, ev.cidade + ' - PE'].filter(Boolean).join(', '))}</span><a href="${esc(mapa)}" ${EXT}>Abrir no Google Maps ${I.ext}${NOVA_ABA}</a></div></li>
        </ul>
        <div class="buybox" data-buybox>
          <div data-cta>${botaoCompraHTML(ev, st)}</div>
          <p class="buybox-hint" data-dica>${I.info}<span>${esc(a.dica)}</span></p>
        </div>
        <div class="share">
          <button class="btn btn-ghost btn-sm" type="button" data-share data-title="${esc(ev.nome + ' | TicketX')}" data-text="${esc(`${ev.nome} · ${quando} · ${ev.local}, ${ev.cidade}`)}" data-url="${esc(abs)}">${I.share} Compartilhar</button>
          <a class="btn btn-ghost btn-sm" href="${esc(waShare)}" ${EXT}>${I.wa} Enviar no WhatsApp${NOVA_ABA}</a>
          <button class="btn btn-ghost btn-sm" type="button" data-copy="${esc(abs)}">${I.link} Copiar link</button>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="wrap ev-body">
  <div class="ev-main">
    <section class="block" aria-labelledby="b-ing"><h2 id="b-ing">Ingressos</h2>${ingressos}</section>
    ${info.length ? `<section class="block" aria-labelledby="b-info"><h2 id="b-info">Informações</h2><div style="display:grid;gap:14px">${info.join('')}</div></section>` : ''}
    ${lineup ? `<section class="block" aria-labelledby="b-line"><h2 id="b-line">Line-up</h2>${lineup}</section>` : ''}
    <section class="block" aria-labelledby="b-local"><h2 id="b-local">Local</h2>
      <div class="place-card"><b>${esc(ev.local)}</b><span>${esc([ev.endereco, ev.cidade + ' - PE'].filter(Boolean).join(', '))}</span><a class="btn btn-ghost btn-sm" href="${esc(mapa)}" ${EXT}>${I.pin} Ver no Google Maps${NOVA_ABA}</a></div>
    </section>
    ${faq.length >= 2 ? `<section class="block" aria-labelledby="b-faq"><h2 id="b-faq">Dúvidas sobre ${esc(ev.nome)}</h2><div class="faq">${faq.map(([q, r]) => `<details><summary>${esc(q)}</summary><div><p>${r}</p></div></details>`).join('')}</div></section>` : ''}
  </div>
  <aside class="ev-aside" aria-label="Ajuda">
    <div class="aside-card"><h2>Precisa de ajuda com este evento?</h2><p>Fale com a equipe da TicketX. A mensagem já vai com o nome do evento.</p><a class="btn btn-whatsapp btn-sm" href="${esc(ajuda)}" ${EXT}>${I.wa} Falar no WhatsApp${NOVA_ABA}</a></div>
    <div class="aside-card"><h2>Descontos em primeira mão</h2><p>No Grupo VIP saem primeiro os links promocionais e as pré-vendas.</p><a class="btn btn-ghost btn-sm" href="${esc(SITE.grupoVip)}" ${EXT}>Entrar no Grupo VIP${NOVA_ABA}</a></div>
    <a class="back-link" href="/agenda/">${I.left} Voltar para a agenda</a>
  </aside>
</div>

${rel.length ? `<section class="related" aria-labelledby="rel-title"><div class="wrap">
  <div class="shelf">
    <div class="shelf-head"><h2 id="rel-title" style="font-size:22px">Você também pode curtir</h2><div class="shelf-arrows"><button type="button" data-dir="-1" aria-label="Ver eventos anteriores">${I.left}</button><button type="button" data-dir="1" aria-label="Ver próximos eventos">${I.right}</button></div></div>
    <div class="shelf-row" tabindex="0" aria-label="Eventos relacionados: role para ver mais">${rel.map(e => cardHTML(e, ctx)).join('')}</div>
  </div>
</div></section>` : ''}

<div class="buybar" data-buybar aria-hidden="true">
  <div class="buybar-info"><b>${esc(ev.nome)}</b><span>${esc(st === 'andamento' ? 'Próxima data: ' + dataCurta(proximaData(ev, HOJE)) : quando)}</span></div>
  <div data-cta-curto>${botaoCompraHTML(ev, st, { classe: 'btn-sm', curto: true })}</div>
</div>
<script type="application/json" id="tx-evento">${JSON.stringify(cliente).replace(/</g, '\\u003c')}</script>`;

  const titulo = `${ev.nome} · ${quando}${ev.cidade ? ' · ' + ev.cidade : ''} | Ingressos TicketX`;
  return layout({
    title: titulo,
    description: descricaoEvento(ev),
    canonical: url,
    og: ev.og,
    ogAlt: `Flyer de ${ev.nome}`,
    current: 'agenda',
    main,
    bodyClass: 'has-buybar',
    preload: ev.img ? `<link rel="preload" as="image" imagesrcset="${ev.img.webp.map(([u, w]) => `${u} ${w}w`).join(', ')}" imagesizes="(max-width:860px) 92vw, 440px" type="image/webp" fetchpriority="high">` : '',
    jsonld: [...jsonLdEvento(ev, st), {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: SITE.url + '/' },
        { '@type': 'ListItem', position: 2, name: 'Agenda', item: SITE.url + '/agenda/' },
        { '@type': 'ListItem', position: 3, name: ev.nome, item: abs },
      ],
    }],
  });
}

/* ------------------------------------------------------------------ */
/* 6. 404, SITEMAP, ROBOTS, MANIFEST                                   */
/* ------------------------------------------------------------------ */
function pagina404() {
  const main = `
<section class="notfound"><div class="wrap">
  <h1>Página não encontrada</h1>
  <p>Este link não existe ou o evento mudou de endereço. Veja a agenda atualizada ou fale com a gente.</p>
  <div class="hero-actions"><a class="btn btn-primary btn-lg" href="/agenda/">Ver agenda</a><a class="btn btn-ghost btn-lg" href="/">Ir para o início</a></div>
</div></section>
${ativos.length ? `<section class="section-tight"><div class="wrap"><h2 class="h2" style="font-size:24px;margin-bottom:18px">Próximos eventos</h2><div class="grid-cards">${ativos.slice(0, 4).map(e => cardHTML(e, ctx)).join('')}</div></div></section>` : ''}`;
  return layout({ title: 'Página não encontrada | TicketX', description: 'Esta página não existe. Veja a agenda de eventos da TicketX.', canonical: '/404', main, noindex: true });
}

function sitemap() {
  const urls = [['/', '1.0'], ['/agenda/', '0.9'], ...ativos.map(e => [`/eventos/${e.slug}/`, '0.8']), ...passados.map(e => [`/eventos/${e.slug}/`, '0.3'])];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, p]) => `  <url><loc>${SITE.url}${u}</loc><lastmod>${HOJE}</lastmod><priority>${p}</priority></url>`).join('\n')}
</urlset>
`;
}

/* ------------------------------------------------------------------ */
/* 7. GERA OS ARQUIVOS                                                 */
/* ------------------------------------------------------------------ */
// apaga páginas de eventos que saíram da lista
if (fs.existsSync(arq('eventos'))) {
  for (const d of fs.readdirSync(arq('eventos'))) {
    if (!slugs.has(d) && fs.existsSync(arq(`eventos/${d}/index.html`))) fs.rmSync(arq(`eventos/${d}`), { recursive: true });
  }
}
escrever('index.html', home());
escrever('agenda/index.html', agenda());
for (const ev of EVENTOS) escrever(`eventos/${ev.slug}/index.html`, paginaEvento(ev));
escrever('404.html', pagina404());
escrever('sitemap.xml', sitemap());
escrever('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
escrever('site.webmanifest', JSON.stringify({
  name: 'TicketX', short_name: 'TicketX', lang: 'pt-BR', start_url: '/', display: 'standalone',
  background_color: '#07040f', theme_color: '#07040f',
  icons: [{ src: '/assets/brand/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/brand/icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 2) + '\n');

if (avisos.length) console.warn('Avisos:\n  - ' + avisos.join('\n  - '));
console.log(`✔ Site gerado (${HOJE}): ${EVENTOS.length} páginas de evento, ${ativos.length} ativos, ${passados.length} encerrados.`);
