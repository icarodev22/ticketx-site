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
- **Aviso de urgência** (ex.: "Últimos ingressos"): só quando a produção confirmar. Aparece no card e na página e some sozinho depois da data.
- **Fotos da festa:** aparecem em "Clima da festa" na página do evento.
- **Carrossel do celular:** todo evento à venda com flyer e link de compra entra sozinho no carrossel de destaques do celular (os fixados em Destaques primeiro). O flyer leva direto ao link de compra.
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
