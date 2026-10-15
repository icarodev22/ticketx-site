# TicketX · ticketxco.com.br

Site estático (HTML, CSS e JavaScript puros) gerado a partir de **um arquivo de dados**. Sem framework, sem banco de dados, sem dependências de produção.

## Estrutura

```
index.html                  home (gerada)
agenda/index.html           agenda completa com busca e filtros (gerada)
eventos/<slug>/index.html   uma página por evento (gerada)
404.html                    página de erro (gerada)
sitemap.xml, robots.txt, site.webmanifest  (gerados)

data/eventos.js             ← ÚNICA FONTE DOS EVENTOS (edite aqui)
scripts/build.mjs           gera todas as páginas a partir dos dados
scripts/otimizar-imagens.py versões WebP dos flyers + prévias do WhatsApp (opcional)
css/site.css                todos os estilos
js/render.js                funções comuns (datas, estado do evento, cards), usadas no build e no navegador
js/site.js                  abertura, menu, compartilhar, barra de compra, estado ao vivo
js/agenda.js                busca, filtros e ordenação
js/shelves.js               fileiras horizontais (setas e arrastar)
assets/brand/               logotipo, ícones, prévia padrão
assets/events/              flyers originais (<slug>.jpg) e opt/ (versões leves)
assets/og/                  prévia 1200x630 de cada evento
assets/fonts/               Poppins hospedada no próprio site
tests/site.test.mjs         testes automáticos (Playwright)
vercel.json                 URLs limpas, cache e cabeçalhos de segurança
```

As páginas `.html` são **geradas**: não edite à mão, edite `data/eventos.js` (ou os modelos em `scripts/build.mjs`) e rode `npm run build`.

## Comandos

```bash
npm run build     # gera o site (Node 18+)
npm run dev       # gera e abre em http://localhost:8080
npm test          # gera e roda os testes (precisa: npm i --no-save playwright && npx playwright install chromium)
```

## Publicar na Vercel

1. Commit e push no GitHub (`icarodev22/ticketx-site`).
2. A Vercel detecta o `package.json` e roda `npm run build`; os arquivos gerados ficam na raiz, que é o que ela publica.
   Em *Project Settings → Build & Development*, deixe **Framework Preset: Other**, **Output Directory** vazio (raiz) e **Build Command** padrão (ou `npm run build`).
3. As páginas geradas também estão no repositório, então o site funciona mesmo se o build da Vercel estiver desligado.

Adicionar evento: veja [COMO-ADICIONAR-EVENTO.md](COMO-ADICIONAR-EVENTO.md).
