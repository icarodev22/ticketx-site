# Painel de eventos (/admin)

Com o painel, qualquer pessoa autorizada cadastra, edita e remove eventos pelo navegador, em **ticketxco.com.br/admin/**, sem mexer em código. Cada "Publicar" grava a mudança no GitHub e a Vercel atualiza o site sozinha em cerca de 1 minuto.

O painel é o [Decap CMS](https://decapcms.org) (gratuito, código aberto). Não tem banco de dados nem mensalidade: os eventos continuam em arquivos dentro do repositório (`content/eventos/<slug>.json`).

## Configuração única (uns 10 minutos, só uma vez)

### 1. Criar o "app de login" no GitHub
1. Entre no GitHub com a conta dona do repositório e abra **https://github.com/settings/developers** → **OAuth Apps** → **New OAuth App**.
2. Preencha:
   - **Application name:** `Painel TicketX`
   - **Homepage URL:** `https://ticketxco.com.br`
   - **Authorization callback URL:** `https://ticketxco.com.br/api/callback/`
3. Clique em **Register application**. Copie o **Client ID**.
4. Clique em **Generate a new client secret** e copie o segredo (ele só aparece uma vez).

### 2. Colocar as duas chaves na Vercel
1. Na Vercel, abra o projeto do site → **Settings** → **Environment Variables**.
2. Adicione (ambiente **Production**):
   - `OAUTH_GITHUB_CLIENT_ID` = o Client ID
   - `OAUTH_GITHUB_CLIENT_SECRET` = o client secret
3. Em **Deployments**, clique nos três pontinhos do último deploy → **Redeploy**, para as chaves valerem.

### 3. Entrar
Abra **https://ticketxco.com.br/admin/** → **Entrar com GitHub** → autorize. Pronto.

## Quem pode entrar
Quem tem permissão de escrita no repositório do GitHub. Para dar acesso a outra pessoa:
1. Ela cria uma conta grátis em github.com.
2. No repositório: **Settings** → **Collaborators** → **Add people** → nome de usuário dela.
3. Ela aceita o convite (chega por e-mail) e já entra no painel.

Para tirar o acesso, remova a pessoa da mesma lista.

## Como funciona por dentro
- `admin/index.html` carrega o painel; `admin/config.yml` define os campos (cada um tem uma explicação que aparece no painel).
- `api/auth.js` e `api/callback.js` são o login com GitHub (funções gratuitas da Vercel).
- Ao publicar, o painel faz um commit em `content/eventos/<slug>.json` (e envia o flyer para `assets/events/`).
- A Vercel roda `npm run build`: gera as versões leves do flyer e a prévia do WhatsApp (`scripts/otimizar-imagens.mjs`) e depois todas as páginas (`scripts/build.mjs`).
- Se algum dado impedir o build, **o site antigo continua no ar**; o erro aparece no painel da Vercel, em Deployments. Erros pequenos (link de compra inválido, hora mal escrita) não travam: o campo é ignorado e aparece um aviso no log.

## Testar no seu computador (sem login, sem publicar)
```bash
npm install
npm run painel
```
Abra http://localhost:8080/admin/ e clique em **Entrar**. O que você salvar grava direto nos arquivos de `content/` e o site em http://localhost:8080 é gerado de novo sozinho. Nada vai para o ar até você fazer commit e push.

## Vender o site para outro cliente
1. Crie um repositório novo para o cliente (por exemplo, use este como template) e um projeto novo na Vercel ligado a ele, com o domínio do cliente.
2. Em `admin/config.yml`, troque `repo`, `base_url`, `site_url` e `display_url` pelo repositório e domínio do cliente.
3. Repita a configuração única acima com o domínio do cliente (um OAuth App por domínio).
4. No painel, em **Configurações do site**, troque Instagram, WhatsApp, Grupo VIP e categorias. Logotipo e cores ficam em `assets/brand/` e `css/site.css`.
5. Adicione o cliente como colaborador do repositório.
