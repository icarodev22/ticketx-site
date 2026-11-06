# Como adicionar ou editar um evento

## Pelo painel (recomendado)
1. Abra **https://ticketxco.com.br/admin/** e entre com o GitHub.
2. **Eventos** → **+ Evento** (ou clique num evento para editar).
3. Preencha. Cada campo tem uma explicação embaixo; o que for opcional e ficar vazio não aparece no site.
4. Clique em **Publicar** → **Publicar agora**. Em cerca de 1 minuto o site está atualizado (home, agenda, página do evento, prévia do WhatsApp, Google e sitemap).

Dicas:
- **Flyer:** vertical, de preferência 4:5 (ex.: 1080x1350), JPG ou PNG. As versões leves são geradas sozinhas.
- **Link de compra:** cole exatamente como recebeu. Os códigos `?d=` e `?afid=` garantem o desconto e a comissão. Sem link, o evento aparece como "Em breve".
- **Endereço da página:** é criado a partir do nome na primeira vez que você salva e não muda mais, para não quebrar links já divulgados.
- **Preços:** só preencha valores confirmados na plataforma de venda.
- **Categorias novas:** em **Configurações do site** → Categorias.
- **Últimos ingressos** (liga/desliga): só quando a produção confirmar que está perto de esgotar. Mostra a etiqueta ÚLTIMOS INGRESSOS no topo do card, nos Destaques, no carrossel do celular e na página do evento. Some sozinha se o evento ficar esgotado, cancelado ou encerrado. No arquivo do evento é `"ultimosIngressos": true` (ou `false`); o texto extra opcional é `"ultimosIngressosTexto"`. Eventos antigos com `"aviso": { "titulo": ... }` continuam funcionando.
- **Fotos da festa:** aparecem em "Clima da festa" na página do evento.
- **Seção Destaques (home):** escolhida sozinha, sem mexer em código, pela regra em `js/render.js` (`selecionarDestaques`), usada no build e de novo no navegador ao abrir a página:
  1. sai quem está encerrado, cancelado, esgotado ou adiado. "Encerrado" conta o horário: com **Hora de início** preenchida, o evento sai dos Destaques quando começa a última data; sem hora, à meia-noite depois do último dia;
  2. ordem dos grupos: **Carvalheira** (categoria Carvalheira), depois **Carnaval** (categoria Carnaval ou "Carnaval" no nome), depois os demais;
  3. dentro de cada grupo: com link de compra antes de "Em breve", depois os marcados em **Fixar em Destaques**, depois a data mais próxima e, no empate, os com Últimos ingressos.
  O primeiro vira o destaque grande; os 4 seguintes aparecem ao lado. Por isso marque sempre a categoria Carvalheira nos eventos da Carvalheira e Carnaval nas festas, prévias e camarotes de Carnaval.
- **Carrossel do celular:** os mesmos destaques, na mesma ordem, que tenham flyer e link de compra (até 4). O flyer leva direto ao link de compra.
- **Filtros no celular:** só "Todos os eventos" e as categorias marcadas como "Filtro no celular" em **Configurações do site** aparecem (hoje Carva e Praia).

## Remover um evento
Não precisa: depois da data ele vira "Evento encerrado" sozinho e continua no histórico da agenda, sem botão de compra. Se quiser tirar mesmo, abra o evento no painel e clique em **Excluir entrada**; a página dele some na próxima publicação.

## Sem o painel (editando os arquivos)
Cada evento é um arquivo `content/eventos/<slug>.json` (o nome do arquivo é o endereço: `bololo.json` vira `/eventos/bololo/`). Copie um parecido, ajuste e rode:

```bash
npm install          # uma vez
npm run build        # gera as páginas; para com erro se algum dado estiver errado
npm run dev          # abre em http://localhost:8080 para conferir
```

Depois faça commit e push; a Vercel publica sozinha. Contatos e categorias ficam em `content/site.json`.
