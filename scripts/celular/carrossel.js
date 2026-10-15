/* Carrossel de destaques do celular (home). Vai embutido no index.html pelo build.
   Só flyers; cada um leva direto ao link de compra do evento (montado no build).
   Troca sozinho a cada 4,5 s, para quando a pessoa toca, quando sai da tela ou
   com "reduzir movimento" ligado. No computador fica escondido e parado. */
const raiz = document.querySelector('[data-carrossel]');
if (raiz) iniciar(raiz);

async function iniciar(raiz) {
  const trilho = raiz.querySelector('[data-trilho]');
  const pontos = raiz.querySelector('[data-pontos]');
  const celular = matchMedia('(max-width:767px)');
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)');

  // tira eventos que encerraram/esgotaram depois que a página foi gerada
  try {
    const { hojeRecife, estadoEvento, acaoCompra } = await import('/js/render.js');
    const dados = JSON.parse(document.getElementById('tx-dados')?.textContent || '{}');
    const hoje = hojeRecife();
    for (const a of trilho.querySelectorAll('[data-slug]')) {
      const ev = (dados.eventos || []).find(e => e.slug === a.dataset.slug);
      if (ev && !acaoCompra(ev, estadoEvento(ev, hoje)).href) a.remove();
    }
  } catch { /* sem dados: mantém o que veio do build */ }

  const slides = [...trilho.children];
  if (!slides.length) { raiz.closest('.tem-carrossel')?.classList.remove('tem-carrossel'); raiz.remove(); return; }
  slides.forEach((s, i) => s.setAttribute('aria-label', s.getAttribute('aria-label').replace(/^\d+ de \d+/, `${i + 1} de ${slides.length}`)));

  let atual = 0;
  if (slides.length > 1) {
    pontos.innerHTML = slides.map((s, i) => `<button type="button" aria-label="Mostrar destaque ${i + 1} de ${slides.length}"${i ? '' : ' aria-current="true"'}></button>`).join('');
    pontos.hidden = false;
  }
  const botoes = [...pontos.children];

  // posição de cada slide centralizado no trilho
  const passo = () => slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : trilho.clientWidth;
  const ir = (i, suave = true) => {
    atual = (i + slides.length) % slides.length;
    trilho.scrollTo({ left: atual * passo(), behavior: suave && !reduzido.matches ? 'smooth' : 'auto' });
    marcar();
  };
  const marcar = () => botoes.forEach((b, i) => b.setAttribute('aria-current', String(i === atual)));

  // acompanha o dedo: o ponto ativo segue o slide que está na tela
  let rolando;
  trilho.addEventListener('scroll', () => {
    clearTimeout(rolando);
    rolando = setTimeout(() => {
      const i = Math.round(trilho.scrollLeft / Math.max(1, passo()));
      if (i !== atual && slides[i]) { atual = i; marcar(); }
    }, 80);
  }, { passive: true });
  botoes.forEach((b, i) => b.addEventListener('click', () => { ir(i); pausarPor(9000); }));

  /* rotação automática */
  const INTERVALO = 4500;
  let timer = null, pausaAte = 0, visivel = false, foco = false;
  const podeRodar = () => slides.length > 1 && celular.matches && !reduzido.matches && visivel && !foco && !document.hidden;
  const tick = () => { if (podeRodar() && Date.now() >= pausaAte) ir(atual + 1); };
  const atualizar = () => {
    if (podeRodar() && !timer) timer = setInterval(tick, INTERVALO);
    else if (!podeRodar() && timer) { clearInterval(timer); timer = null; }
  };
  const pausarPor = ms => { pausaAte = Date.now() + ms; };

  trilho.addEventListener('pointerdown', () => pausarPor(9000), { passive: true });
  trilho.addEventListener('touchstart', () => pausarPor(9000), { passive: true });
  raiz.addEventListener('focusin', () => { foco = true; atualizar(); });
  raiz.addEventListener('focusout', () => { foco = false; atualizar(); });
  document.addEventListener('visibilitychange', atualizar);
  celular.addEventListener?.('change', atualizar);
  reduzido.addEventListener?.('change', atualizar);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; atualizar(); }, { threshold: 0.5 }).observe(raiz);
  } else { visivel = true; atualizar(); }
}
