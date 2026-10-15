/* Login do painel (/admin) com GitHub, passo 2: o GitHub volta aqui com um
   código, trocamos pelo token e entregamos ao painel (janela que abriu o login),
   no formato que o Decap CMS espera. */
/* o painel pode estar aberto com ou sem www */
const variantes = o => {
  const h = new URL(o).host;
  return [o, 'https://' + (h.startsWith('www.') ? h.slice(4) : 'www.' + h)];
};

function pagina(res, status, mensagem, origem) {
  const corpo = JSON.stringify(mensagem).replace(/</g, '\\u003c');
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', 'tx_oauth_state=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  res.end(`<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><title>Entrando…</title>
<body style="font-family:system-ui;padding:24px">Conectando ao painel… pode fechar esta janela se ela não fechar sozinha.
<script>
(function () {
  var msg = ${corpo}, aceitas = ${JSON.stringify(variantes(origem))};
  /* celular: a janela de login às vezes perde o vínculo com o painel
     (abre em outra aba ou pelo app do GitHub). Aí o login é salvo direto
     neste navegador e a pessoa volta para o painel já conectada. */
  if (!window.opener) {
    var pre = 'authorization:github:success:';
    if (typeof msg === 'string' && msg.indexOf(pre) === 0) {
      try {
        var dados = JSON.parse(msg.slice(pre.length));
        localStorage.setItem('decap-cms-user', JSON.stringify({ token: dados.token, backendName: 'github' }));
        location.replace('/admin/');
      } catch (e) {
        document.body.textContent = 'Não consegui concluir o login neste navegador. Abra o painel no Chrome e tente de novo.';
      }
    } else if (typeof msg === 'string') {
      document.body.textContent = 'Erro no login. Volte ao painel e tente de novo.';
    }
    return;
  }
  window.addEventListener('message', function ok(e) {
    if (aceitas.indexOf(e.origin) < 0) return;
    window.removeEventListener('message', ok);
    window.opener.postMessage(msg, e.origin);
    setTimeout(function () { window.close(); }, 300);
  });
  window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`);
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origem = `https://${host}`;
  const url = new URL(req.url, origem);
  const erro = texto => pagina(res, 401, 'authorization:github:error:' + JSON.stringify({ message: texto }), origem);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = /(?:^|;\s*)tx_oauth_state=([a-f0-9]+)/.exec(req.headers.cookie || '');
  if (!code || !state || !cookie || cookie[1] !== state) return erro('Login expirado ou inválido. Feche esta janela e tente de novo.');

  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.OAUTH_GITHUB_CLIENT_ID,
        client_secret: process.env.OAUTH_GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origem}/api/callback/`,
      }),
    });
    const dados = await r.json();
    if (!dados.access_token) return erro(dados.error_description || 'O GitHub não liberou o acesso.');
    return pagina(res, 200, 'authorization:github:success:' + JSON.stringify({ token: dados.access_token, provider: 'github' }), origem);
  } catch {
    return erro('Não consegui falar com o GitHub. Tente de novo.');
  }
}