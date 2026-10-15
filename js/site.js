/* Comportamentos comuns a todas as páginas:
   abertura (carregamento), menu, compartilhar/copiar, barra de compra,
   atualização do estado do evento pela data de hoje. */
import { hojeRecife, estadoEvento, ROTULO_ESTADO, acaoCompra, botaoCompraHTML } from './render.js';
import { iniciarPrateleiras } from './shelves.js';

const root = document.documentElement;
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. ABERTURA ----------
   Mede de verdade: fontes + imagens marcadas como críticas.
   Se houver menos de 2 itens, fica indeterminada (sem porcentagem inventada).
   Sai assim que tudo carregar, ou em no máximo 4 s, mesmo se algo falhar. */
(function abertura() {
  const intro = document.querySelector('.intro');
  if (!intro || root.classList.contains('no-intro')) { intro?.remove(); return; }
  const fill = intro.querySelector('.intro-fill');
  const status = intro.querySelector('.intro-status');
  const inicio = performance.now();
  const MIN = reduzido ? 0 : 900, MAX = 4000;

  const tarefas = [];
  if (document.fonts?.ready) tarefas.push(document.fonts.ready);
  document.querySelectorAll('img[data-critical], .ev-poster img').forEach(img => {
    if (img.complete) return tarefas.push(Promise.resolve());
    tarefas.push(new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }));
  });

  let feitas = 0, fim = false;
  const medir = tarefas.length >= 2;
  if (medir) { fill.classList.remove('indeterminate'); fill.style.setProperty('--p', 0); status.textContent = '0%'; }
  tarefas.forEach(t => t.then(() => {
    feitas++;
    if (medir && !fim) {
      const p = feitas / tarefas.length;
      fill.style.setProperty('--p', p.toFixed(3));
      status.textContent = Math.round(p * 100) + '%';
    }
  }, () => {}));

  function sair(motivo) {
    if (fim) return;
    fim = true;
    const espera = Math.max(0, MIN - (performance.now() - inicio));
    setTimeout(() => {
      if (motivo === 'tempo') status.textContent = 'Abrindo';
      fill.classList.remove('indeterminate');
      fill.style.setProperty('--p', motivo === 'ok' ? 1 : fill.style.getPropertyValue('--p') || 0);
      intro.classList.add('done');
      try { sessionStorage.setItem('tx-intro', '1'); } catch (e) { /* modo privado */ }
      setTimeout(() => intro.remove(), 600);
    }, espera);
  }
  Promise.allSettled(tarefas).then(() => sair('ok'));
  setTimeout(() => sair('tempo'), MAX);
})();

/* ---------- 2. MENU MOBILE ---------- */
(function menu() {
  const btn = document.querySelector('.menu-btn');
  const drawer = document.getElementById('menu');
  if (!btn || !drawer) return;
  const panel = drawer.querySelector('.drawer-panel');
  const focaveis = () => [...panel.querySelectorAll('a[href],button:not([disabled])')];
  const abrir = () => {
    drawer.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('lock');
    setTimeout(() => focaveis()[1]?.focus(), 50);
  };
  const fechar = (voltarFoco = true) => {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('lock');
    if (voltarFoco) btn.focus();
  };
  btn.addEventListener('click', abrir);
  drawer.querySelectorAll('[data-close-menu]').forEach(el => el.addEventListener('click', () => fechar()));
  drawer.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => fechar(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
  drawer.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      const f = focaveis(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // se a tela crescer (girar o tablet), fecha o menu
  matchMedia('(min-width: 861px)').addEventListener('change', e => { if (e.matches) fechar(false); });
})();

/* ---------- 3. AVISO (toast), COPIAR E COMPARTILHAR ---------- */
const toastEl = document.querySelector('.toast');
let toastT;
export function aviso(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
}
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // navegadores antigos ou sem permissão
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
document.addEventListener('click', async e => {
  const c = e.target.closest('[data-copy]');
  if (c) {
    const ok = await copiar(c.dataset.copy);
    aviso(ok ? 'Link copiado!' : 'Não deu para copiar. Link: ' + c.dataset.copy);
    return;
  }
  const s = e.target.closest('[data-share]');
  if (s) {
    const dados = { title: s.dataset.title, text: s.dataset.text, url: s.dataset.url };
    if (navigator.share) {
      try { await navigator.share(dados); } catch (err) { if (err.name !== 'AbortError') aviso('Não foi possível compartilhar.'); }
    } else {
      const ok = await copiar(dados.url);
      aviso(ok ? 'Link copiado! É só colar onde quiser.' : 'Link: ' + dados.url);
    }
  }
});

/* ---------- 4. PÁGINA DO EVENTO: estado pela data de hoje ---------- */
(function estadoAoVivo() {
  const el = document.getElementById('tx-evento');
  if (!el) return;
  let ev;
  try { ev = JSON.parse(el.textContent); } catch { return; }
  const st = estadoEvento(ev, hojeRecife());
  if (st === ev.estadoBuild) return;
  // a página foi gerada antes; a data mudou o estado (ex.: evento passou)
  const tag = document.querySelector('[data-estado-tag]');
  if (tag) {
    tag.hidden = !ROTULO_ESTADO[st];
    tag.className = `tag tag-state s-${st}`;
    tag.textContent = ROTULO_ESTADO[st];
  }
  const a = acaoCompra(ev, st);
  const cta = document.querySelector('[data-cta]');
  if (cta) cta.innerHTML = botaoCompraHTML(ev, st);
  const curto = document.querySelector('[data-cta-curto]');
  if (curto) curto.innerHTML = botaoCompraHTML(ev, st, { classe: 'btn-sm', curto: true });
  const dica = document.querySelector('[data-dica] span');
  if (dica) dica.textContent = a.dica;
  if (!a.selo) document.querySelector('[data-selo]')?.remove();
})();

/* ---------- 5. BARRA DE COMPRA FIXA (celular) ---------- */
(function barraCompra() {
  const bar = document.querySelector('[data-buybar]');
  const box = document.querySelector('[data-buybox]');
  if (!bar || !box || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([en]) => {
    // mostra a barra sempre que o botão principal de compra não estiver na tela
    const passou = !en.isIntersecting;
    bar.classList.toggle('show', passou);
    bar.setAttribute('aria-hidden', String(!passou));
    bar.querySelectorAll('a,button').forEach(x => passou ? x.removeAttribute('tabindex') : x.setAttribute('tabindex', '-1'));
  }).observe(box);
  bar.querySelectorAll('a,button').forEach(x => x.setAttribute('tabindex', '-1'));
})();

/* ---------- 6. DIVERSOS ---------- */
iniciarPrateleiras();
document.querySelectorAll('[data-ano]').forEach(el => { el.textContent = hojeRecife().slice(0, 4); });
// imagens que falharam antes deste script já foram tratadas no <head>;
// esta parte cobre imagens que já estavam "completas" mas quebradas
document.querySelectorAll('[data-fallback] img').forEach(img => {
  if (img.complete && img.naturalWidth === 0) img.closest('[data-fallback]').classList.add('img-failed');
});
