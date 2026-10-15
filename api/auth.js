/* Login do painel (/admin) com GitHub, passo 1: manda a pessoa para o GitHub.
   Função da Vercel. Precisa das variáveis de ambiente OAUTH_GITHUB_CLIENT_ID e
   OAUTH_GITHUB_CLIENT_SECRET (veja PAINEL-CONFIGURACAO.md). */
import crypto from 'node:crypto';

export default function handler(req, res) {
  const id = process.env.OAUTH_GITHUB_CLIENT_ID;
  if (!id) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Login do painel ainda não configurado: falta OAUTH_GITHUB_CLIENT_ID na Vercel (veja PAINEL-CONFIGURACAO.md).');
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = new URL(req.url, `https://${host}`);
  const scope = url.searchParams.get('scope') === 'public_repo' ? 'public_repo' : 'repo';
  const state = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `tx_oauth_state=${state}; Path=/api; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
  const destino = new URL('https://github.com/login/oauth/authorize');
  destino.searchParams.set('client_id', id);
  destino.searchParams.set('redirect_uri', `https://${host}/api/callback/`);
  destino.searchParams.set('scope', scope);
  destino.searchParams.set('state', state);
  res.statusCode = 302;
  res.setHeader('Location', destino.toString());
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}
