/* Prateleiras horizontais: setas, arrastar com o mouse e toque nativo. */
export function iniciarPrateleiras(raiz = document) {
  raiz.querySelectorAll('.shelf').forEach(shelf => {
    const row = shelf.querySelector('.shelf-row');
    if (!row || row.dataset.pronto) return;
    row.dataset.pronto = '1';
    const [prev, next] = shelf.querySelectorAll('.shelf-arrows button');

    const atualizar = () => {
      if (!prev) return;
      const max = row.scrollWidth - row.clientWidth - 2;
      prev.disabled = row.scrollLeft <= 2;
      next.disabled = row.scrollLeft >= max;
      shelf.querySelector('.shelf-arrows').hidden = max <= 0;
    };
    shelf.querySelectorAll('.shelf-arrows button').forEach(b => b.addEventListener('click', () => {
      row.scrollBy({ left: Number(b.dataset.dir) * Math.max(row.clientWidth * 0.85, 240), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }));
    row.addEventListener('scroll', atualizar, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(atualizar).observe(row);
    atualizar();

    // arrastar com o mouse (no toque o navegador já rola sozinho)
    let x0 = 0, s0 = 0, ativo = false, arrastou = false;
    row.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      ativo = true; arrastou = false; x0 = e.clientX; s0 = row.scrollLeft;
    });
    window.addEventListener('pointermove', e => {
      if (!ativo) return;
      const dx = e.clientX - x0;
      if (!arrastou && Math.abs(dx) > 6) { arrastou = true; row.classList.add('dragging'); }
      if (arrastou) row.scrollLeft = s0 - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!ativo) return;
      ativo = false;
      if (arrastou) {
        row.classList.remove('dragging');
        // evita abrir o card ao soltar o mouse depois de arrastar
        const bloquear = ev => { ev.preventDefault(); ev.stopPropagation(); };
        row.addEventListener('click', bloquear, true);
        setTimeout(() => row.removeEventListener('click', bloquear, true), 60);
      }
    });
    // impede o "arrastar imagem/link" nativo do navegador
    row.addEventListener('dragstart', e => e.preventDefault());
  });
}
