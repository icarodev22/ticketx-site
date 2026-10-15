/* Busca, filtros e ordenação da agenda (home e /agenda/).
   Os dados vêm do JSON embutido na página (#tx-dados), gerado de content/ pelo build. */
import { cardHTML, estadoEvento, proximaData, textoBusca, semAcento, hojeRecife, esc } from './render.js';
import { iniciarPrateleiras } from './shelves.js';

const dadosEl = document.getElementById('tx-dados');
const box = document.querySelector('[data-agenda]');

if (dadosEl && box) {
  let dados;
  try { dados = JSON.parse(dadosEl.textContent); } catch { dados = null; }
  if (dados && Array.isArray(dados.eventos)) iniciar(dados);
}

function iniciar({ eventos, categorias, hojeBuild }) {
  const modo = box.dataset.agenda; // 'home' | 'agenda'
  const hoje = hojeRecife();
  const ctx = { hoje, categorias };
  // valida antes de usar: evento sem dados mínimos não entra
  const evs = eventos.filter(e => e && e.slug && e.nome && Array.isArray(e.datas) && e.datas.length)
    .map(e => ({ ...e, _busca: textoBusca(e, categorias), _estado: estadoEvento(e, hoje), _prox: proximaData(e, hoje) }));
  const passou = e => e._estado === 'encerrado' || e._estado === 'cancelado';

  const form = box.querySelector('[data-filtros]');
  const q = form.querySelector('input[name=q]');
  const cidade = form.querySelector('select[name=cidade]');
  const ordem = form.querySelector('select[name=ordem]');
  const chips = [...form.querySelectorAll('.chip')];
  const contagem = box.querySelector('[data-contagem]');
  const prateleiras = box.querySelector('[data-prateleiras]');
  const resultados = box.querySelector('[data-resultados]');
  const vazio = box.querySelector('[data-vazio]');
  const passadosBox = box.querySelector('[data-passados]');
  const passadosLista = box.querySelector('[data-passados-lista]');

  /* estado inicial a partir da URL (?q=&categoria=&cidade=&ordem=) */
  const params = new URLSearchParams(location.search);
  const estado = {
    q: (params.get('q') || '').slice(0, 80),
    cat: params.get('categoria') || '',
    cidade: params.get('cidade') || '',
    ordem: params.get('ordem') === 'desc' ? 'desc' : 'asc',
  };
  if (!categorias.some(c => c.id === estado.cat)) estado.cat = '';
  if (![...cidade.options].some(o => o.value === estado.cidade)) estado.cidade = '';
  q.value = estado.q; cidade.value = estado.cidade; ordem.value = estado.ordem;

  // se a página foi gerada em outro dia, o estado dos eventos pode ter mudado
  const desatualizada = hoje !== hojeBuild;

  function filtrar(lista) {
    const termos = semAcento(estado.q).split(/\s+/).filter(Boolean);
    return lista.filter(e =>
      termos.every(t => e._busca.includes(t)) &&
      (!estado.cat || (e.categorias || []).includes(estado.cat)) &&
      (!estado.cidade || e.cidade === estado.cidade));
  }
  const ordenar = lista => [...lista].sort((a, b) => estado.ordem === 'desc' ? b._prox.localeCompare(a._prox) : a._prox.localeCompare(b._prox));
  const ativo = () => !!(estado.q || estado.cat || estado.cidade || estado.ordem === 'desc');

  function sincronizarURL() {
    const p = new URLSearchParams();
    if (estado.q) p.set('q', estado.q);
    if (estado.cat) p.set('categoria', estado.cat);
    if (estado.cidade) p.set('cidade', estado.cidade);
    if (estado.ordem === 'desc') p.set('ordem', 'desc');
    const s = p.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }

  function render(primeira = false) {
    chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.cat === estado.cat)));
    const futuros = evs.filter(e => !passou(e));
    const achados = ordenar(filtrar(futuros));
    const achadosPassados = filtrar(evs.filter(passou)).sort((a, b) => b.datas[b.datas.length - 1].localeCompare(a.datas[a.datas.length - 1]));

    if (modo === 'home' && !ativo()) {
      // sem filtro: mostra as prateleiras (já vêm prontas do HTML)
      prateleiras.hidden = false; resultados.hidden = true; vazio.hidden = true; contagem.hidden = true;
      if (primeira && desatualizada) renderPrateleiras(futuros);
      return;
    }
    if (prateleiras) prateleiras.hidden = true;
    contagem.hidden = false;
    const n = achados.length;
    const filtros = [estado.q && `“${esc(estado.q)}”`, estado.cat && esc(categorias.find(c => c.id === estado.cat)?.nome || ''), estado.cidade && esc(estado.cidade)].filter(Boolean).join(' · ');
    contagem.innerHTML = `<span><strong>${n}</strong> ${n === 1 ? 'evento encontrado' : 'eventos encontrados'}${filtros ? ' para ' + filtros : ''}</span>${ativo() ? '<button type="button" class="btn btn-ghost btn-sm" data-limpar>Limpar filtros</button>' : ''}`;

    if (!primeira || modo === 'home' || desatualizada || ativo()) {
      resultados.innerHTML = achados.map(e => cardHTML(e, ctx)).join('');
    }
    resultados.hidden = n === 0;

    if (n === 0) {
      const dica = achadosPassados.length
        ? `<p>Encontramos ${achadosPassados.length} ${achadosPassados.length === 1 ? 'evento encerrado' : 'eventos encerrados'} com esse filtro${modo === 'agenda' ? ', listados mais abaixo' : ''}.</p>`
        : '<p>Tente buscar pelo nome da festa, de um artista ou da cidade.</p>';
      vazio.innerHTML = `<div class="empty"><h3>Nenhum evento disponível com esses filtros</h3>${dica}<button type="button" class="btn btn-primary" data-limpar>Limpar filtros e ver todos</button></div>`;
      vazio.hidden = false;
    } else vazio.hidden = true;

    if (passadosBox) {
      if (!primeira || desatualizada || ativo()) passadosLista.innerHTML = achadosPassados.map(e => cardHTML(e, ctx)).join('');
      passadosBox.hidden = achadosPassados.length === 0;
    }
  }

  function renderPrateleiras(futuros) {
    const fix = l => [...l].sort((a, b) => (b.destaque === true) - (a.destaque === true) || a._prox.localeCompare(b._prox));
    const porData = l => [...l].sort((a, b) => a._prox.localeCompare(b._prox));
    const grupos = [['proximos', 'Próximos eventos', porData(futuros)], ...categorias.map(c => [c.id, c.nome, fix(futuros.filter(e => e.categorias.includes(c.id)))])];
    prateleiras.querySelectorAll('.shelf').forEach(sh => {
      const id = sh.querySelector('h3')?.id?.replace('sh-', '');
      const g = grupos.find(x => x[0] === id);
      if (!g || !g[2].length) { sh.hidden = true; return; }
      sh.querySelector('.shelf-row').innerHTML = g[2].map(e => cardHTML(e, ctx)).join('');
    });
  }

  /* eventos da interface */
  let t;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { estado.q = q.value.trim().slice(0, 80); render(); sincronizarURL(); }, 160);
  });
  q.addEventListener('keydown', e => { if (e.key === 'Escape' && q.value) { q.value = ''; estado.q = ''; render(); sincronizarURL(); } });
  cidade.addEventListener('change', () => { estado.cidade = cidade.value; render(); sincronizarURL(); });
  ordem.addEventListener('change', () => { estado.ordem = ordem.value; render(); sincronizarURL(); });
  chips.forEach(c => c.addEventListener('click', () => {
    estado.cat = estado.cat === c.dataset.cat ? '' : c.dataset.cat;
    render(); sincronizarURL();
  }));
  box.addEventListener('click', e => {
    if (!e.target.closest('[data-limpar]')) return;
    Object.assign(estado, { q: '', cat: '', cidade: '', ordem: 'asc' });
    q.value = ''; cidade.value = ''; ordem.value = 'asc';
    render(); sincronizarURL();
    q.focus();
  });

  render(true);
  iniciarPrateleiras(box);
  // se chegou com filtro na URL da home, leva o visitante até a agenda
  if (modo === 'home' && ativo() && !location.hash) box.scrollIntoView();
}
