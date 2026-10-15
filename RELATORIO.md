# TicketX v2: relatório da reformulação

Data: 14/10/2026. Base: `index.html` enviado (idêntico ao do repositório `icarodev22/ticketx-site`, commit `b236d49`).

## 1. Arquitetura escolhida e por quê

Mantive **HTML, CSS e JS puros**, sem React/Next e sem banco de dados. A novidade é um script Node sem dependências (`scripts/build.mjs`) que lê `data/eventos.js` e **gera páginas estáticas reais** para cada evento em `eventos/<slug>/`. Isso resolve o pedido principal (URL própria, prévia correta no WhatsApp, funciona ao recarregar e no Google) com o mínimo de infraestrutura. Não há preço ou disponibilidade em tempo real: isso exigiria uma API das plataformas de venda, que não existe hoje no projeto.

## 2. Melhorias implementadas

**Páginas de evento (prioridade máxima)**
- 10 páginas em `ticketxco.com.br/eventos/<slug>/`, acessíveis direto, ao recarregar e por link do WhatsApp.
- Cada uma tem: flyer em alta, categoria, data com dia da semana, horário (quando informado), local, endereço, botão do Google Maps, estado do evento, bloco de ingressos, informações, regras, classificação, line-up por dia, dúvidas do evento (só com dados reais), ajuda pelo WhatsApp com o nome do evento na mensagem, relacionados e voltar para a agenda.
- Compartilhar (menu nativo do celular), enviar no WhatsApp (texto com nome, data, local e link) e copiar link.
- Barra de compra fixa no celular, que aparece sempre que o botão principal sai da tela.
- Título, descrição, canonical, Open Graph e Twitter próprios; prévia 1200x630 por evento (`assets/og/`).
- Schema.org `Event` só com nome, data e local confirmados; o Barchef (dias 24 e 31, não seguidos) gera um `Event` por data.
- Links antigos `ticketxco.com.br/#barchef` redirecionam para a página nova.

**Agenda inteligente** (`/agenda/` e na home)
- Busca por nome, artista, cidade, local e categoria, sem diferenciar acento ("safadao" acha "Safadão").
- Filtro por categoria e por cidade, ordenação por data, tudo combinado; o estado fica na URL (`/agenda/?categoria=vaquejada`), então o botão voltar não perde o filtro.
- Mensagem quando nada é encontrado + botão "Limpar filtros".
- Estado calculado pela data de hoje (fuso de Recife): "É hoje", "Em andamento", "Evento encerrado". Encerrado sai das listas de próximos, vai para o histórico e perde o botão de compra. Esgotado, cancelado e adiado só aparecem se forem marcados nos dados.
- Fileiras com setas que desativam no fim, toque nativo e arrastar com o mouse.

**Compra**
- Botões diferentes para cada caso: "Comprar com 5% OFF" (Sympla), "Pedir pelo WhatsApp" (sem taxa), "Comprar ingresso", "Em breve", "Esgotado", "Evento encerrado", "Evento cancelado".
- Abaixo do botão, uma linha explica para onde ele leva.
- Links de compra copiados sem nenhuma alteração (os testes conferem um por um contra os dados).
- Removido o cálculo automático de "preço com desconto": o site não inventa valores. Há um campo `ingressos` pronto para setor, lote e preço confirmados.

**Abertura (carregamento)**
- Nova abertura com o ícone e o logo, luz roxa e magenta.
- A barra mede de verdade: fontes + imagens críticas da primeira tela. Se houver menos de 2 itens para medir, fica indeterminada (sem porcentagem falsa).
- Sai assim que tudo carrega (mínimo de 0,9 s para a animação) ou em no máximo 4 s, mesmo com falha. Se o JavaScript nem rodar, o CSS a esconde em 6 s.
- Aparece só na primeira página da visita; ao navegar pelo site, não repete.
- Com "reduzir movimento" ativado, não anima.

**Home**: cabeçalho com Agenda e Grupo VIP, menu mobile acessível, hero com atalhos por categoria, Destaques (evento fixado + próximos 3), agenda com busca, vantagens, Grupo VIP, Instagram, FAQ e rodapé com contatos. As fileiras por categoria só aparecem para categorias com 3+ eventos, para a página não ficar repetitiva; as demais ficam nos filtros.

**Performance**
- Flyers em WebP em 3 tamanhos (480, 640, 960 px) com JPG de reserva; `width`/`height` em todas as imagens; `lazy` só fora da primeira tela; flyer da página do evento pré-carregado com prioridade alta.
- Poppins hospedada no próprio site (5 arquivos de ~8 KB) com fonte reserva de medidas parecidas, sem depender do Google Fonts.
- Efeitos pesados de scroll removidos (barra de progresso, parallax, clip-path ligado ao scroll), como você já tinha pedido. Ficaram só transições curtas de transform/opacity.
- Cache longo para fontes e imagens (`vercel.json`).

**Acessibilidade**: um h1 por página, hierarquia de títulos, "Pular para o conteúdo", foco visível, menu com foco preso e Esc, chips com `aria-pressed`, contagem de resultados anunciada, rótulos em busca e selects, textos alternativos, áreas de toque de 44 px, estado nunca indicado só por cor.

**Segurança**: todo texto vindo dos dados é escapado antes de virar HTML; só links `http(s)` são aceitos; o build valida os dados e para com mensagem clara se algo estiver errado (slug, data, link, categoria, preço); `noopener noreferrer` em links externos; cabeçalhos `nosniff`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`.

## 3. Problemas encontrados e corrigidos

| Problema no site atual | Correção |
|---|---|
| Home com 9,4 MB: flyers JPG de até 3280x4096 px (1,3 MB cada) | WebP redimensionado; home agora 576 KB |
| Loader esperava o `load` (todas as imagens) e era animação infinita | Abertura com medição real e tempo máximo |
| Página do evento era só um modal em `#slug`; o WhatsApp mostrava a prévia da home | Páginas estáticas reais por evento |
| "Agenda completa" era uma camada sem URL própria, com botão "← Voltar para a agenda" (deveria voltar para o início) | Página `/agenda/` real |
| Vaquejada Vitória (10/10) continuava com "Comprar" depois da data | Estado automático "Evento encerrado" |
| `<p>` do hero não fechado (HTML inválido) | Corrigido |
| Link "feito pela results.ag" com `href="#"` | Virou texto (falta o endereço certo) |
| `javascript:void(0)` e `onclick` inline | Removidos |
| Classe `event-barchef` sem CSS | Removida |
| Dois sistemas de animação de entrada fazendo a mesma coisa; CSS de seções removidas (avaliações, estatísticas, preço comparado) ainda no arquivo | Código reescrito sem duplicação |
| Menu mobile não fechava com Esc nem controlava o foco; botão de 38 px | Corrigido, 44 px |
| Modal com `100vh` (corta no Safari iOS); `overflow-x:hidden` no body escondendo estouros | `dvh`/safe-area; nenhuma rolagem horizontal sem precisar esconder |
| Line-up do Bololo era uma única string com vírgulas | Lista de artistas |
| Wedo dizia "Line-up ainda não anunciado" mas listava 5 artistas (que estão no flyer) | Frase removida |

## 4. Dados: o que mudou e o que precisa da sua conferência

Nenhum evento, data, link ou artista foi inventado. Acrescentei informações **das páginas oficiais na Sympla** (consultadas em 14/10/2026):
- **Bololô**: endereço (Av. Sul Gov. Cid Sampaio, 4921, Imbiribeira, Recife), horário 23h às 5h10, classificação 18 anos. Nome com acento como no flyer.
- **Bikini Memories**: full open bar nos dois dias e regras de entrada (sem alimentos/bebidas, revista, sem reentrada).
- **Réveillon Amoré**: open bar nas festas noturnas de 27 a 31/12, Moréa sem open bar, ingressos sem hospedagem/transfer.
- **Carvalheira na Ladeira**: line-up completo por dia, residentes e limite de 2 ingressos por CPF. **Confira o line-up**, pois foi transcrito da Sympla.

Pontos para você confirmar:
1. **Réveillon Amoré**: o link de compra usa `?d=MILTONV`, diferente do `TICKETX` dos outros. Mantive como estava.
2. **Réveillon Amoré**: a Sympla mostra o período de 26/12 (18h) a 01/01; o site mantém 27 a 31/12 (as 5 festas).
3. Categorias "Samba" (Barchef) e "Praia" (Bikini, Réveillon, Wedo) foram criadas a partir do nome e do local dos eventos. Ajuste no topo de `data/eventos.js` se preferir outras.
4. Flyers `churrascarva.jpg`, `swagg.jpg` e `vintage.jpg` estão na pasta mas não têm dados nem link no site atual, então não viraram eventos.

## 5. Testes executados

`npm test` roda **45 testes no Chromium (Playwright)**, todos passando na última execução:
- Todas as 12 páginas (home, agenda, 10 eventos): sem erro no console, sem arquivo 404, sem ID duplicado, sem link vazio/`#`/`javascript:`, todo `target=_blank` com `noopener`, exatamente um h1, toda imagem com `alt`.
- Cada evento: link de compra idêntico ao dos dados (encerrado sem link), canonical, og:title com o nome, og:image existente, texto do WhatsApp com nome e URL, JSON-LD válido.
- Busca sem acento, busca vazia + limpar, categoria + cidade vindas da URL, ordenação, filtros da home, setas das fileiras.
- Link antigo `/#barchef`, evento inexistente (404), voltar mantém o filtro, menu mobile (abrir, Esc, foco, fechar ao navegar), primeiro Tab no "Pular para o conteúdo", copiar link.
- Abertura: some sozinha e não repete; com fontes e imagens bloqueadas libera a tela e o flyer mostra o nome; sem JavaScript some pelo CSS; com movimento reduzido sai rápido; com o relógio adiantado, a página do evento troca para "encerrado" e tira o link.
- Sem rolagem horizontal em 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440 e 1920 px e no celular deitado (844x390), em 5 páginas.

**Lighthouse (mobile simulado, servidor local)**:

| Página | Performance | Acessibilidade | Boas práticas | SEO | LCP | CLS | Peso |
|---|---|---|---|---|---|---|---|
| Home atual | 68 | 94 | 100 | 92 | 10,3 s | 0 | 9,4 MB |
| Home nova | 97 | 100 | 100 | 100 | 2,5 s | 0,023 | 576 KB |
| Agenda nova | 89 | 100 | 100 | 100 | 3,7 s | 0 | 740 KB |
| Evento (Bololô) | 84 | 100 | 100 | 100 | 4,5 s | 0 | 672 KB |

Os números são de um servidor local, não da Vercel em produção.

**Não testado**: Safari/iPhone, Chrome Android, Firefox e Edge reais. Usei só o Chromium em modo headless, com larguras de celular, tablet e desktop.

## 6. O que ainda depende de você ou de serviços externos

- **Preços e lotes**: nenhum confirmado, então nenhum aparece. Preencha `ingressos` no evento quando tiver.
- **Feed do Instagram**: mostrar posts de verdade exige a API da Meta (token de acesso). Hoje é um bloco com link para o perfil.
- **results.ag**: me passe o endereço certo para voltar a ser link.
- **CNPJ / dados institucionais**: continuam fora, como você pediu antes.
- **Prévia do WhatsApp**: o WhatsApp guarda a prévia antiga por um tempo; para testar, envie o link com `?v=2` no final.
- **Vercel**: conferir em *Project Settings* que o Framework Preset é "Other" e o Output Directory está vazio (raiz).
- Arquivos soltos no repositório (`WhatsApp Image 2026-09-30 at 09.27.17.jpeg` na raiz, `ticketx-site`, um submódulo git vazio) não são usados; pode apagar.

## 7. Como publicar

1. Copie o conteúdo desta pasta para o repositório `ticketx-site` (substituindo o `index.html`; os flyers originais continuam nos mesmos caminhos).
2. `npm run build` (opcional localmente; a Vercel roda também).
3. Commit e push. A Vercel publica.
4. Depois de publicar, envie no Search Console o `https://ticketxco.com.br/sitemap.xml`.

## 8. Como adicionar um evento

Veja `COMO-ADICIONAR-EVENTO.md`. Resumo: flyer em `assets/events/<slug>.jpg`, copiar um evento em `data/eventos.js`, `npm run build`, push. O build avisa e para se algum dado estiver errado.
