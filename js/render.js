/* Funções compartilhadas entre o build (Node) e o navegador.
   Não use nada de DOM aqui: este arquivo também roda no Node. */

export const FUSO = 'America/Recife';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/* ---------- segurança ---------- */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/* só deixa passar links http(s) e wa.me; qualquer outra coisa vira null */
export function urlSegura(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? u : null;
  } catch { return null; }
}
export function semAcento(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* ---------- datas ---------- */
export function hojeRecife(agora = new Date()) {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
function partes(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}
function consecutivas(datas) {
  for (let i = 1; i < datas.length; i++) {
    const a = Date.UTC(...datas[i - 1].split('-').map((n, k) => k === 1 ? n - 1 : +n));
    const b = Date.UTC(...datas[i].split('-').map((n, k) => k === 1 ? n - 1 : +n));
    if (b - a !== 86400000) return false;
  }
  return true;
}
function juntar(lista) {
  return lista.length < 2 ? lista.join('') : lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
}
/* "16 de outubro de 2026", "27 a 31 de dezembro de 2026", "24 e 31 de outubro de 2026" */
export function dataPorExtenso(datas) {
  const ps = datas.map(partes);
  const f = ps[0], l = ps[ps.length - 1];
  if (ps.length === 1) return `${f.d} de ${MESES[f.m - 1]} de ${f.y}`;
  const mesmoMes = ps.every(p => p.m === f.m && p.y === f.y);
  if (mesmoMes) {
    if (ps.length > 2 && consecutivas(datas)) return `${f.d} a ${l.d} de ${MESES[f.m - 1]} de ${f.y}`;
    return `${juntar(ps.map(p => p.d))} de ${MESES[f.m - 1]} de ${f.y}`;
  }
  if (consecutivas(datas)) return `${f.d} de ${MESES[f.m - 1]} a ${l.d} de ${MESES[l.m - 1]} de ${l.y}`;
  return juntar(ps.map(p => `${p.d} de ${MESES[p.m - 1]}`)) + ` de ${l.y}`;
}
/* "sexta-feira" | "sex 20/11 e sáb 21/11" | "sáb 27/12 a qui 31/12" */
export function diasDaSemana(datas) {
  const ps = datas.map(partes);
  if (ps.length === 1) return DIAS[ps[0].wd];
  const c = p => `${DIAS_CURTO[p.wd]} ${p.d}/${p.m}`;
  if (ps.length > 2 && consecutivas(datas)) return `${c(ps[0])} a ${c(ps[ps.length - 1])}`;
  return juntar(ps.map(c));
}
/* selo do card: { dia:'27–31', mes:'DEZ' } */
export function seloData(datas) {
  const ps = datas.map(partes);
  const f = ps[0], l = ps[ps.length - 1];
  if (ps.length === 1) return { dia: String(f.d), mes: MES_CURTO[f.m - 1] };
  if (f.m === l.m) {
    const dia = ps.length > 2 && consecutivas(datas) ? `${f.d}–${l.d}` : ps.map(p => p.d).join(consecutivas(datas) ? '–' : ' · ');
    return { dia, mes: MES_CURTO[f.m - 1] };
  }
  return { dia: `${f.d}/${f.m}–${l.d}/${l.m}`, mes: String(l.y) };
}
export function dataCurta(iso) {
  const p = partes(iso);
  return `${DIAS_CURTO[p.wd]}, ${p.d} de ${MESES[p.m - 1].slice(0, 3)}`;
}

/* ---------- estado do evento ---------- */
export function estadoEvento(ev, hoje) {
  const primeira = ev.datas[0], ultima = ev.datas[ev.datas.length - 1];
  if (ev.status === 'cancelado') return 'cancelado';
  if (hoje > ultima) return 'encerrado';
  if (ev.status === 'adiado') return 'adiado';
  if (ev.status === 'esgotado') return 'esgotado';
  if (ev.datas.includes(hoje)) return 'hoje';
  if (hoje > primeira) return 'andamento';
  return 'proximo';
}
export const ROTULO_ESTADO = {
  proximo: '', hoje: 'É hoje', andamento: 'Em andamento',
  encerrado: 'Evento encerrado', cancelado: 'Evento cancelado', adiado: 'Adiado', esgotado: 'Esgotado',
};
export function proximaData(ev, hoje) {
  return ev.datas.find(d => d >= hoje) || ev.datas[ev.datas.length - 1];
}

/* aviso de urgência ("Últimos ingressos"): só enquanto o evento está à venda */
export function avisoAtivo(ev, estado) {
  if (!ev.aviso || !ev.aviso.titulo) return null;
  return ['proximo', 'hoje', 'andamento', 'adiado'].includes(estado) ? ev.aviso : null;
}

/* ---------- destaques: filtro e ordem (uma regra só para build e navegador) ----------
   1. tira o que não pode ser destacado: encerrado (inclusive pelo horário),
      cancelado, esgotado e adiado;
   2. ordena por prioridade: Carvalheira, depois Carnaval, depois o resto;
   3. dentro de cada grupo: com link de compra primeiro, depois "Fixar em
      Destaques", depois a data mais próxima e, no empate, "Últimos ingressos". */

/* "AAAA-MM-DDTHH:MM" no horário de Recife */
export function agoraRecife(agora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/* a última sessão já começou? Com "hora" informada, vale o horário de início
   do último dia; sem hora, o evento vale até o fim do último dia. */
export function ultimaSessaoPassou(ev, agoraIso) {
  const ultima = ev.datas[ev.datas.length - 1];
  return agoraIso >= `${ultima}T${ev.hora || '24:00'}`;
}
export function ehCarvalheira(ev) {
  return (ev.categorias || []).includes('carvalheira');
}
export function ehCarnaval(ev) {
  return (ev.categorias || []).includes('carnaval') || /carnaval|pr[ée]via carnavalesca/i.test(ev.nome || '');
}
export function prioridadeDestaque(ev) {
  return ehCarvalheira(ev) ? 1 : ehCarnaval(ev) ? 2 : 3;
}
const FORA_DOS_DESTAQUES = ['encerrado', 'cancelado', 'esgotado', 'adiado'];
export function podeSerDestaque(ev, agoraIso) {
  if (!ev.datas || !ev.datas.length) return false;
  if (FORA_DOS_DESTAQUES.includes(estadoEvento(ev, agoraIso.slice(0, 10)))) return false;
  return !ultimaSessaoPassou(ev, agoraIso);
}
/* devolve a lista pronta para a seção Destaques (o primeiro vira o destaque grande) */
export function selecionarDestaques(eventos, agoraIso) {
  const hoje = agoraIso.slice(0, 10);
  const chave = ev => {
    const st = estadoEvento(ev, hoje);
    return {
      grupo: prioridadeDestaque(ev),
      compra: acaoCompra(ev, st).href ? 0 : 1,
      fixo: ev.destaque === true ? 0 : 1,
      data: proximaData(ev, hoje) + 'T' + (ev.hora || '00:00'),
      ultimos: avisoAtivo(ev, st) ? 0 : 1,
    };
  };
  return eventos.filter(ev => podeSerDestaque(ev, agoraIso))
    .map(ev => ({ ev, k: chave(ev) }))
    .sort((a, b) => a.k.grupo - b.k.grupo || a.k.compra - b.k.compra || a.k.fixo - b.k.fixo
      || a.k.data.localeCompare(b.k.data) || a.k.ultimos - b.k.ultimos || a.ev.slug.localeCompare(b.ev.slug))
    .map(x => x.ev);
}

/* ---------- compra ---------- */
/* Devolve o que o botão de compra deve mostrar. href null = sem link. */
export function acaoCompra(ev, estado) {
  const c = ev.compra;
  if (estado === 'encerrado') return { tipo: 'encerrado', rotulo: 'Evento encerrado', href: null, dica: 'Este evento já aconteceu.' };
  if (estado === 'cancelado') return { tipo: 'cancelado', rotulo: 'Evento cancelado', href: null, dica: 'Este evento foi cancelado.' };
  if (estado === 'esgotado') return { tipo: 'esgotado', rotulo: 'Esgotado', href: null, dica: 'Os ingressos esgotaram.' };
  const href = c && urlSegura(c.url);
  if (!c || !href) return { tipo: 'em-breve', rotulo: 'Em breve', href: null, dica: 'Os ingressos ainda não estão disponíveis pela TicketX.' };
  if (c.tipo === 'desconto') return {
    tipo: 'desconto', rotulo: 'LINK COM DESCONTO', curto: 'LINK COM DESCONTO', href,
    selo: 'Link com ' + (c.desconto || 'desconto'),
    dica: `Abre a ${c.plataforma || 'plataforma de venda'} pelo link de desconto da TicketX. Confira o valor final antes de pagar.`,
  };
  if (c.tipo === 'whatsapp') return {
    tipo: 'whatsapp', rotulo: 'COMPRE SEM TAXA', curto: 'COMPRE SEM TAXA', href, selo: 'Vendas sem taxa',
    dica: 'Abre uma conversa com a TicketX no WhatsApp, com o nome do evento já escrito. Vendas sem taxa.',
  };
  return {
    tipo: 'link', rotulo: 'COMPRAR INGRESSO', curto: 'COMPRAR INGRESSO', href,
    dica: `Abre a página oficial de venda${c.plataforma ? ' na ' + c.plataforma : ''}.`,
  };
}

/* ---------- textos auxiliares ---------- */
export function nomeCategoria(id, categorias) {
  return (categorias.find(c => c.id === id) || {}).nome || id;
}
export function artistas(ev) {
  if (!ev.lineup) return [];
  return Array.isArray(ev.lineup) ? ev.lineup : Object.values(ev.lineup).flat();
}
export function textoBusca(ev, categorias) {
  return semAcento([ev.nome, ev.local, ev.endereco, ev.cidade, ev.descricao, ...artistas(ev), ...(ev.categorias || []).map(c => nomeCategoria(c, categorias))].join(' '));
}

/* ---------- imagem do flyer ---------- */
/* ev.img vem do build: { webp:[[url,largura],...], jpg:url, w, h } */
export function pictureHTML(ev, { sizes, eager = false, classe = 'flyer', alt } = {}) {
  const img = ev.img;
  if (!img) return '';
  const alt_ = alt ?? `Flyer do evento ${ev.nome}`;
  const load = eager ? `loading="eager"${eager === 'high' || classe !== 'flyer' ? ' fetchpriority="high"' : ''}` : 'loading="lazy"';
  const fonte = img.webp && img.webp.length
    ? `<source type="image/webp" srcset="${img.webp.map(([u, w]) => `${esc(u)} ${w}w`).join(', ')}" sizes="${esc(sizes)}">` : '';
  return `<picture>${fonte}<img class="${classe}" src="${esc(img.jpg)}" alt="${esc(alt_)}" width="${img.w}" height="${img.h}" ${load} decoding="async"></picture>`;
}

/* etiqueta "Últimos ingressos" (cards, destaques e carrossel do celular) */
export function seloUltimosHTML(aviso, classe = 'badge') {
  return `<span class="${classe} badge-aviso" data-ultimos><i aria-hidden="true"></i>${esc(aviso.titulo)}</span>`;
}

/* ---------- card ---------- */
export function cardHTML(ev, ctx) {
  const { hoje, categorias, eager = false } = ctx;
  const estado = estadoEvento(ev, hoje);
  const acao = acaoCompra(ev, estado);
  const selo = seloData(ev.datas);
  const url = `/eventos/${ev.slug}/`;
  const passado = ['encerrado', 'cancelado'].includes(estado);
  const estadoTxt = ROTULO_ESTADO[estado];
  const aviso = avisoAtivo(ev, estado);
  // "Últimos ingressos" é uma faixa no topo do card (avisoAtivo já some com esgotado/encerrado/cancelado);
  // o selo de estado/oferta continua no canto
  const flag = aviso ? seloUltimosHTML(aviso, 'card-flag') : '';
  const badge = estadoTxt ? `<span class="badge badge-${estado}">${esc(estadoTxt)}</span>`
    : acao.selo ? `<span class="badge badge-${acao.tipo}">${esc(acao.selo)}</span>` : '';
  const cat = ev.categorias && ev.categorias[0] ? nomeCategoria(ev.categorias[0], categorias) : '';
  const quando = estado === 'andamento' ? 'Próxima data: ' + dataCurta(proximaData(ev, hoje)) : dataPorExtenso(ev.datas);
  const botao = acao.href
    ? `<a class="btn btn-sm btn-${acao.tipo}" href="${esc(acao.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc((acao.curto || acao.rotulo) + ': ' + ev.nome)} (abre em nova aba)">${esc(acao.curto || acao.rotulo)}</a>`
    : `<span class="btn btn-sm btn-off">${esc(acao.rotulo)}</span>`;
  return `<article class="card${ev.destaque ? ' card-pinned' : ''}${passado ? ' card-past' : ''}${aviso ? ' card-ultimos' : ''}" data-slug="${esc(ev.slug)}">
  <div class="card-media" data-fallback="${esc(ev.nome)}">
    ${pictureHTML(ev, { sizes: '(max-width:560px) 60vw, 250px', eager, alt: '' })}
    ${flag}
    <span class="card-date" aria-hidden="true"><b>${esc(selo.dia)}</b><small>${esc(selo.mes)}</small></span>
    ${badge}
    ${ev.destaque && !passado ? '<span class="pin">★ Destaque</span>' : ''}
  </div>
  <div class="card-body">
    ${cat ? `<p class="card-cat">${esc(cat)}</p>` : ''}
    <h3 class="card-title"><a class="card-link" href="${url}">${esc(ev.nome)}</a></h3>
    <p class="card-meta">${esc(quando)}</p>
    <p class="card-meta card-place">${esc(ev.local)}${ev.cidade ? ' · ' + esc(ev.cidade) : ''}</p>
    <div class="card-actions">${botao}</div>
  </div>
</article>`;
}

/* botão principal de compra (página do evento e barra fixa) */
export function botaoCompraHTML(ev, estado, { classe = 'btn-lg btn-block', curto = false } = {}) {
  const a = acaoCompra(ev, estado);
  const txt = curto ? (a.curto || a.rotulo) : a.rotulo;
  if (!a.href) return `<span class="btn btn-off ${classe}" data-compra>${esc(a.rotulo)}</span>`;
  return `<a class="btn btn-${a.tipo} ${classe}" data-compra href="${esc(a.href)}" target="_blank" rel="noopener noreferrer">${esc(txt)}<span class="sr-only"> (abre em nova aba)</span></a>`;
}

/* ---------- seção Destaques da home ----------
   Gerada no build e, se a data/hora mudou o resultado, de novo no navegador
   (js/destaques.js), sempre a partir de selecionarDestaques(). */
const ICO_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
const ICO_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const EXT_ = 'target="_blank" rel="noopener noreferrer"';
export const MAX_DESTAQUES = 5;
/* "assinatura" do que a seção mostra: muda se mudar evento, ordem, estado ou etiqueta */
export function assinaturaDestaques(lista, hoje) {
  return lista.slice(0, MAX_DESTAQUES).map(e => {
    const st = estadoEvento(e, hoje);
    return `${e.slug}:${st}${avisoAtivo(e, st) ? ':ultimos' : ''}`;
  }).join(' ');
}

function rotuloGrupo(ev, categorias) {
  if (ehCarvalheira(ev)) return nomeCategoria('carvalheira', categorias);
  if (ehCarnaval(ev)) return 'Carnaval';
  return ev.categorias && ev.categorias[0] ? nomeCategoria(ev.categorias[0], categorias) : '';
}
const srcsetWebp = img => img.webp.map(([u, w]) => `${esc(u)} ${w}w`).join(', ');

export function destaquesHTML(lista, { hoje, categorias }) {
  const sel = lista.slice(0, MAX_DESTAQUES);
  const principal = sel[0];
  const outros = sel.slice(1);
  /* celular: só os flyers, cada um leva direto ao link de compra */
  const carrossel = sel.filter(e => e.img && acaoCompra(e, estadoEvento(e, hoje)).href).slice(0, 4);
  const carrosselHTML = carrossel.length ? `<div class="mcar" data-carrossel aria-roledescription="carrossel" aria-label="Destaques: toque no flyer para comprar">
      <div class="mcar-track" data-trilho>${carrossel.map((e, i) => {
        const st = estadoEvento(e, hoje), av = avisoAtivo(e, st);
        return `<a class="mcar-slide" href="${esc(acaoCompra(e, st).href)}" ${EXT_} data-slug="${esc(e.slug)}" role="group" aria-roledescription="slide" aria-label="${i + 1} de ${carrossel.length}: comprar ingresso de ${esc(e.nome)}${av ? ' (' + esc(av.titulo) + ')' : ''} (abre em nova aba)"><picture><source media="(min-width:768px)" srcset="${BLANK}"><source type="image/webp" srcset="${srcsetWebp(e.img)}" sizes="(max-width:767px) calc(100vw - 32px), 1px"><img src="${esc(e.img.jpg)}" alt="${esc(e.nome)}" width="${e.img.w}" height="${e.img.h}" loading="lazy" decoding="async"></picture>${av ? seloUltimosHTML(av, 'mcar-flag') : ''}</a>`;
      }).join('')}</div>
      <div class="mcar-dots" data-pontos hidden></div>
    </div>` : '';

  const spot = principal ? (() => {
    const st = estadoEvento(principal, hoje), a = acaoCompra(principal, st), av = avisoAtivo(principal, st);
    const grupo = rotuloGrupo(principal, categorias);
    const quando = st === 'andamento' ? 'Próxima data: ' + dataCurta(proximaData(principal, hoje)) : dataPorExtenso(principal.datas);
    const nomes = artistas(principal);
    return `<article class="spotlight${av ? ' spotlight-ultimos' : ''}" data-slug="${esc(principal.slug)}">
      <a class="spotlight-media" href="/eventos/${esc(principal.slug)}/" tabindex="-1" aria-hidden="true" data-fallback="${esc(principal.nome)}">${pictureHTML(principal, { sizes: '(max-width:860px) 100vw, 340px', alt: '' })}${av ? seloUltimosHTML(av, 'spot-flag') : ''}</a>
      <div class="spotlight-body">
        <div class="ev-tags">${principal.destaque ? '<span class="tag tag-pin">★ Destaque TicketX</span>' : '<span class="tag">Em destaque</span>'}${grupo ? `<span class="tag">${esc(grupo)}</span>` : ''}${ROTULO_ESTADO[st] ? `<span class="tag tag-state s-${st}">${esc(ROTULO_ESTADO[st])}</span>` : ''}${a.selo ? `<span class="tag ${a.tipo === 'desconto' ? 'tag-offer' : 'tag-free'}">${esc(a.selo)}</span>` : ''}</div>
        <h3><a href="/eventos/${esc(principal.slug)}/">${esc(principal.nome)}</a></h3>
        <div class="spotlight-facts"><span>${ICO_CAL}${esc(quando)}${principal.hora ? ' · ' + esc(principal.horario || principal.hora) : ''}</span><span>${ICO_PIN}${esc(principal.local)}${principal.cidade ? ' · ' + esc(principal.cidade) : ''}</span></div>
        ${nomes.length ? `<p class="lead">${esc(nomes.slice(0, 6).join(', '))}${nomes.length > 6 ? ' e mais' : ''}</p>` : ''}
        ${av && av.texto ? `<p class="spotlight-urg"><i aria-hidden="true"></i>${esc(av.texto)}</p>` : ''}
        <div class="spotlight-actions">${botaoCompraHTML(principal, st, { classe: '' })}<a class="btn btn-ghost" href="/eventos/${esc(principal.slug)}/">Ver detalhes</a></div>
        <p class="spotlight-hint">${esc(a.dica)}</p>
      </div>
    </article>`;
  })() : '';

  const proxHTML = outros.length ? `<div class="next-list" data-n="${outros.length}">${outros.map(e => {
    const st = estadoEvento(e, hoje), a = acaoCompra(e, st), av = avisoAtivo(e, st);
    const grupo = rotuloGrupo(e, categorias);
    return `<a class="next-item${av ? ' next-ultimos' : ''}" href="/eventos/${esc(e.slug)}/" data-slug="${esc(e.slug)}">${e.img ? `<span class="next-thumb" data-fallback="">${pictureHTML(e, { sizes: '72px', alt: '' })}</span>` : '<span class="next-thumb"></span>'}<div>${av ? seloUltimosHTML(av, 'next-flag') : grupo ? `<small class="next-cat">${esc(grupo)}</small>` : ''}<b>${esc(e.nome)}</b><span>${esc(dataCurta(proximaData(e, hoje)))}${e.cidade ? ' · ' + esc(e.cidade) : ''}</span><em class="next-cta next-${a.tipo}">${esc(a.href ? (a.curto || a.rotulo) : a.rotulo)}</em></div></a>`;
  }).join('')}</div>` : '';

  if (!principal) return `<p class="lead destaques-vazio">Nenhum evento em destaque agora. Veja a <a href="/agenda/">agenda completa</a>.</p>`;
  return `${carrosselHTML}\n    ${spot}\n    ${proxHTML}`;
}
