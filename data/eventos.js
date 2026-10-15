/* ==========================================================================
   DADOS DA TICKETX
   --------------------------------------------------------------------------
   Os eventos ficam em content/eventos/<slug>.json (um arquivo por evento) e
   as configurações gerais em content/site.json. Os dois são editados pelo
   painel em ticketxco.com.br/admin/, sem mexer em código.

   Este arquivo lê esses JSON, limpa o que veio vazio do painel e entrega
   para o build o mesmo formato de antes (EVENTOS, CATEGORIAS, SITE).
   Problemas que dá para contornar sem quebrar o site (link de compra
   inválido, hora mal escrita) viram AVISOS e o campo é ignorado; assim um
   erro de digitação no painel não derruba a publicação.

   O nome do arquivo é o slug: content/eventos/bololo.json vira
   ticketxco.com.br/eventos/bololo/. O painel cria o nome a partir do nome
   do evento na primeira vez que ele é salvo e não muda depois.
   Campos: veja admin/config.yml (cada campo tem uma explicação).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = path.join(RAIZ, 'content', 'eventos');

export const AVISOS_DADOS = [];

const lerJSON = f => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { throw new Error(`${path.relative(RAIZ, f)}: JSON inválido (${e.message})`); }
};

/* tira "", [], null e objetos vazios que o painel grava em campos não preenchidos */
function limpar(v) {
  if (Array.isArray(v)) {
    const a = v.map(limpar).filter(x => x !== undefined);
    return a.length ? a : undefined;
  }
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) { const y = limpar(x); if (y !== undefined) o[k] = y; }
    return Object.keys(o).length ? o : undefined;
  }
  if (typeof v === 'string') { const s = v.trim(); return s ? s : undefined; }
  return v === null ? undefined : v;
}

const site = lerJSON(path.join(RAIZ, 'content', 'site.json'));
export const CATEGORIAS = (site.categorias || []).map(c => ({ id: String(c.id).trim(), nome: String(c.nome).trim() }));
export const SITE = { fuso: 'America/Recife', ...Object.fromEntries(Object.entries(site).filter(([k]) => k !== 'categorias')) };

function normalizar(slug, bruto) {
  const ev = limpar(bruto) || {};
  const q = `content/eventos/${slug}.json`;
  const out = { slug, ...ev };

  if (Array.isArray(out.datas)) out.datas = [...new Set(out.datas.map(d => String(d).slice(0, 10)))].sort();

  if (out.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(out.hora)) {
    AVISOS_DADOS.push(`${q}: hora "${out.hora}" ignorada (use HH:MM, ex.: 22:00).`);
    delete out.hora;
  }

  // compra: "nenhum" ou link faltando = "Em breve"
  const c = out.compra;
  if (!c || !c.tipo || c.tipo === 'nenhum') delete out.compra;
  else if (!/^https:\/\//.test(c.url || '') || (c.tipo === 'whatsapp' && !/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(c.url))) {
    AVISOS_DADOS.push(`${q}: link de compra ${c.url ? `"${c.url}" inválido` : 'vazio'}; o evento vai aparecer como "Em breve".`);
    delete out.compra;
  }

  if (!out.status || out.status === 'normal') delete out.status;
  if (out.destaque !== true) delete out.destaque;

  // line-up: o painel grava [{ dia, artistas }]; o site usa lista simples ou { dia: [...] }
  if (Array.isArray(out.lineup)) {
    const grupos = out.lineup.filter(g => g.artistas && g.artistas.length);
    if (!grupos.length) delete out.lineup;
    else if (grupos.length === 1 && !grupos[0].dia) out.lineup = grupos[0].artistas;
    else out.lineup = Object.fromEntries(grupos.map((g, i) => [g.dia || (i ? `Dia ${i + 1}` : 'Line-up'), g.artistas]));
  }

  // categorias que não existem mais são ignoradas
  if (Array.isArray(out.categorias)) {
    const ids = new Set(CATEGORIAS.map(x => x.id));
    const fora = out.categorias.filter(x => !ids.has(x));
    if (fora.length && fora.length < out.categorias.length) {
      AVISOS_DADOS.push(`${q}: categoria(s) ${fora.join(', ')} não existem mais e foram ignoradas.`);
      out.categorias = out.categorias.filter(x => ids.has(x));
    }
  }

  // aviso de urgência ("Últimos ingressos"): sem título não aparece
  if (out.aviso && !out.aviso.titulo) delete out.aviso;

  // fotos: o painel grava o caminho inteiro; o build usa o nome dentro de assets/events/fotos/
  if (Array.isArray(out.fotos)) {
    out.fotos = out.fotos.filter(f => f.arquivo).map(f => ({ ...f, arquivo: f.arquivo.replace(/^\/?assets\/events\/fotos\//, ''), alt: f.alt || `Foto do evento ${out.nome || ''}`.trim() }))
      .filter(f => {
        if (fs.existsSync(path.join(RAIZ, 'assets/events/fotos', f.arquivo))) return true;
        AVISOS_DADOS.push(`${q}: foto assets/events/fotos/${f.arquivo} não encontrada; foi ignorada.`);
        return false;
      });
    if (!out.fotos.length) delete out.fotos;
  }

  if (out.ingressos) for (const t of out.ingressos) if (typeof t.preco === 'string') {
    const n = Number(t.preco.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(n)) t.preco = n;
  }
  return out;
}

export const EVENTOS = fs.readdirSync(PASTA)
  .filter(f => f.endsWith('.json'))
  .map(f => normalizar(f.slice(0, -5), lerJSON(path.join(PASTA, f))))
  .sort((a, b) => ((a.datas || [''])[0]).localeCompare((b.datas || [''])[0]) || a.slug.localeCompare(b.slug));
