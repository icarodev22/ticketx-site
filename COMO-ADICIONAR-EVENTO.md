# Como adicionar ou editar um evento

Tudo sai de **um arquivo só**: `data/eventos.js`. Cards, agenda, página do evento, prévia do WhatsApp, Google e sitemap são gerados a partir dele.

## 1. Flyer
Salve em `assets/events/<slug>.jpg` (vertical, de preferência 4:5).
O *slug* é o endereço da página: `bololo` vira `ticketxco.com.br/eventos/bololo/`. Só minúsculas, números e hífen.

## 2. Dados
Abra `data/eventos.js`, copie um evento parecido e ajuste. Modelo:

```js
{
  slug: 'nome-da-festa',
  nome: 'Nome da Festa',
  datas: ['2026-12-05'],                 // vários dias: ['2026-12-05', '2026-12-06']
  hora: '22:00',                          // opcional, só se confirmado
  horario: 'A partir das 22h',            // opcional
  categorias: ['carvalheira'],            // ids da lista CATEGORIAS no topo do arquivo
  local: 'Nome do espaço',
  endereco: 'Rua, número, bairro',        // opcional
  cidade: 'Recife',
  compra: { tipo: 'desconto', url: 'https://www.sympla.com.br/...?d=TICKETX', plataforma: 'Sympla', desconto: '5% OFF' },
  lineup: ['Artista 1', 'Artista 2'],     // opcional
},
```

Tipos de compra:
- `desconto`: link parceiro com desconto (botão "Comprar com 5% OFF").
- `whatsapp`: venda sem taxa pelo WhatsApp. Use um link `https://wa.me/5581991017226?text=...` com o nome da festa na mensagem.
- `link`: link de venda comum, sem desconto.
- Sem `compra`: aparece "Em breve".

**Cole o link de compra exatamente como recebeu.** Os códigos `?d=` e `?afid=` são o que garante o desconto e a comissão.

Campos opcionais (o que não for preenchido não aparece no site): `endereco`, `hora`, `horario`, `lineup` (lista ou por dia), `lineupNota`, `descricao`, `classificacao`, `condicoes`, `regras`, `ingressos` (setor, lote e preço confirmados), `destaque: true` (fixa o evento em Destaques) e `status: 'esgotado' | 'cancelado' | 'adiado'` (só quando confirmado). "Evento encerrado" é automático pela data.

## 3. Gerar e conferir
```bash
python3 scripts/otimizar-imagens.py   # opcional: versões leves + prévia do WhatsApp
npm run build                         # gera as páginas; para com erro se algum dado estiver errado
npm run dev                           # abre em http://localhost:8080 para conferir
```

Se o build mostrar "✖ Corrija antes de publicar", ele diz qual evento e qual campo.

## 4. Publicar
Faça commit e push para o GitHub. A Vercel publica sozinha (e roda o `npm run build` de novo).

## Remover um evento
Não precisa remover: depois da data ele vira "Evento encerrado" sozinho e continua no histórico da agenda, sem botão de compra. Se apagar do arquivo, a página dele some no próximo build.
