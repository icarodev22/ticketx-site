/* Reduz as imagens antes de o painel enviá-las ao GitHub.
   Foto de celular (principalmente iPhone, em HEIC) costuma ter vários MB e o
   GitHub recusa com "Sorry, your input was too large to process". Aqui, ao
   escolher uma imagem, ela vira um JPG de no máximo 2000 px no lado maior
   (~0,3 a 1 MB), que é mais do que o site usa (o maior tamanho gerado é 1200 px).
   Imagens que já são leves (JPG/PNG/WebP até 1,5 MB e 2400 px) passam sem mudança. */
(() => {
  const LADO_MAX = 2000, LEVE_BYTES = 1.5 * 1024 * 1024, LEVE_LADO = 2400, LIMITE = 5 * 1024 * 1024;
  const NOSSO = Symbol('tx-reduzida');
  const ehImagem = f => /^image\//.test(f.type) && !/svg|gif/.test(f.type) || /\.(heic|heif)$/i.test(f.name);

  function aviso(txt, erro) {
    let el = document.getElementById('tx-aviso-img');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tx-aviso-img';
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:90vw;padding:12px 18px;border-radius:10px;font:15px/1.4 system-ui,sans-serif;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.3)';
      document.body.appendChild(el);
    }
    el.style.background = erro ? '#c0392b' : '#5b2bd6';
    el.textContent = txt;
    el.hidden = !txt;
    clearTimeout(el._t);
    if (txt && erro) el._t = setTimeout(() => (el.hidden = true), 8000);
  }

  async function abrir(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }

  async function reduzir(file) {
    if (!ehImagem(file)) return file;
    const img = await abrir(file);
    const w = img.width, h = img.height;
    const jaLeve = /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= LEVE_BYTES && Math.max(w, h) <= LEVE_LADO;
    if (jaLeve) return file;
    const k = Math.min(1, LADO_MAX / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#07040f'; // fundo do site, para PNG com transparência
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (img.close) img.close();
    let blob;
    for (const q of [0.85, 0.75, 0.62]) {
      blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= LEVE_BYTES) break;
    }
    if (!blob) throw new Error('toBlob');
    const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() });
  }

  window.addEventListener('change', async e => {
    const inp = e.target;
    if (e[NOSSO] || !(inp instanceof HTMLInputElement) || inp.type !== 'file' || !inp.files) return;
    const arquivos = [...inp.files];
    if (!arquivos.some(ehImagem)) return;
    // segura o envio do painel até a imagem ficar pronta
    e.stopImmediatePropagation();
    e.stopPropagation();
    aviso('Preparando a imagem...');
    try {
      const prontos = [];
      for (const f of arquivos) prontos.push(await reduzir(f));
      if (prontos.some(f => f.size > LIMITE)) throw new Error('grande');
      const dt = new DataTransfer();
      prontos.forEach(f => dt.items.add(f));
      inp.files = dt.files;
      aviso('');
      const ev = new Event('change', { bubbles: true });
      ev[NOSSO] = true;
      inp.dispatchEvent(ev);
    } catch (err) {
      console.warn('reduzir-imagem:', err);
      inp.value = '';
      aviso('Não consegui abrir essa imagem. Envie o flyer em JPG ou PNG (no iPhone: tire um print da imagem e envie o print).', true);
    }
  }, true);
})();
