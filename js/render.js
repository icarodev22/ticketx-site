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
    tipo: 'desconto', rotulo: 'Comprar com desconto', curto: 'Comprar com ' + (c.desconto || 'desconto'), href,
    selo: 'Link com ' + (c.desconto || 'desconto'),
    dica: `Abre a ${c.plataforma || 'plataforma de venda'} pelo link de desconto da TicketX. Confira o valor final antes de pagar.`,
  };
  if (c.tipo === 'whatsapp') return {
    tipo: 'whatsapp', rotulo: 'Pedir pelo WhatsApp', curto: 'Pedir no WhatsApp', href, selo: 'Vendas sem taxa',
    dica: 'Abre uma conversa com a TicketX no WhatsApp, com o nome do evento já escrito. Vendas sem taxa.',
  };
  return {
    tipo: 'link', rotulo: 'Comprar ingresso', curto: 'Comprar ingresso', href,
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

/* ---------- card ---------- */
export function cardHTML(ev, ctx) {
  const { hoje, categorias, eager = false } = ctx;
  const estado = estadoEvento(ev, hoje);
  const acao = acaoCompra(ev, estado);
  const selo = seloData(ev.datas);
  const url = `/eventos/${ev.slug}/`;
  const passado = ['encerrado', 'cancelado'].includes(estado);
  const estadoTxt = ROTULO_ESTADO[estado];
  const badge = estadoTxt
    ? `<span class="badge badge-${estado}">${esc(estadoTxt)}</span>`
    : acao.selo ? `<span class="badge badge-${acao.tipo}">${esc(acao.selo)}</span>` : '';
  const cat = ev.categorias && ev.categorias[0] ? nomeCategoria(ev.categorias[0], categorias) : '';
  const quando = estado === 'andamento' ? 'Próxima data: ' + dataCurta(proximaData(ev, hoje)) : dataPorExtenso(ev.datas);
  const botao = acao.href
    ? `<a class="btn btn-sm btn-${acao.tipo}" href="${esc(acao.href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc((acao.curto || acao.rotulo) + ': ' + ev.nome)} (abre em nova aba)">${esc(acao.curto || acao.rotulo)}</a>`
    : `<span class="btn btn-sm btn-off">${esc(acao.rotulo)}</span>`;
  return `<article class="card${ev.destaque ? ' card-pinned' : ''}${passado ? ' card-past' : ''}" data-slug="${esc(ev.slug)}">
  <div class="card-media" data-fallback="${esc(ev.nome)}">
    ${pictureHTML(ev, { sizes: '(max-width:560px) 60vw, 250px', eager, alt: '' })}
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
  const txt = curto ? (a.curto || a.rotulo) : (a.tipo === 'desconto' && ev.compra.desconto ? `Comprar com ${ev.compra.desconto}` : a.rotulo);
  if (!a.href) return `<span class="btn btn-off ${classe}" data-compra>${esc(a.rotulo)}</span>`;
  return `<a class="btn btn-${a.tipo} ${classe}" data-compra href="${esc(a.href)}" target="_blank" rel="noopener noreferrer">${esc(txt)}<span class="sr-only"> (abre em nova aba)</span></a>`;
}
