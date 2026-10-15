/* Fileira "Próximos eventos" da home girando sozinha (computador e celular).
   Avança um card a cada 4 s e volta ao início no fim. Para com o mouse em cima,
   com foco do teclado, quando a pessoa arrasta ou usa as setas, fora da tela
   e com "reduzir movimento". Vai embutido no index.html pelo build. */
const fileira = document.querySelector('[data-rotativo] .shelf-row');
if (fileira) {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
  let pausaAte = 0, emCima = false, foco = false, visivel = false;
  const pausar = ms => { pausaAte = Date.now() + ms; };
  const passo = () => {
    const c = fileira.children;
    return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : fileira.clientWidth;
  };
  setInterval(() => {
    if (reduzido.matches || emCima || foco || !visivel || document.hidden || Date.now() < pausaAte) return;
    if (fileira.classList.contains('dragging')) return;
    const fim = fileira.scrollWidth - fileira.clientWidth - 4;
    if (fim <= 0) return;
    if (fileira.scrollLeft >= fim) fileira.scrollTo({ left: 0, behavior: 'smooth' });
    else fileira.scrollBy({ left: passo(), behavior: 'smooth' });
  }, 4000);
  const shelf = fileira.closest('.shelf');
  shelf.addEventListener('mouseenter', () => { emCima = true; });
  shelf.addEventListener('mouseleave', () => { emCima = false; pausar(1500); });
  shelf.addEventListener('focusin', () => { foco = true; });
  shelf.addEventListener('focusout', () => { foco = false; });
  shelf.addEventListener('pointerdown', () => pausar(9000), { passive: true });
  shelf.addEventListener('touchstart', () => pausar(9000), { passive: true });
  shelf.addEventListener('wheel', () => pausar(9000), { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }, { threshold: 0.4 }).observe(fileira);
  else visivel = true;
}
