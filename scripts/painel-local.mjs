/* Painel no seu computador, sem login e sem publicar nada:
     npm run painel
   Abre o site em http://localhost:8080 e o painel em http://localhost:8080/admin/.
   O que você salvar no painel grava direto nos arquivos de content/ e o site
   é gerado de novo sozinho. Para publicar, faça commit e push como sempre. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.env.PORT || 8080);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.yml': 'text/yaml; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

const gerar = () => spawnSync(process.execPath, ['scripts/otimizar-imagens.mjs'], { cwd: RAIZ, stdio: 'inherit' }).status === 0
  && spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: RAIZ, stdio: 'inherit' });
gerar();

// servidor do painel (decap-server) na porta 8081
const cms = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'decap-server@3.11.3'], { cwd: RAIZ, stdio: 'inherit', shell: process.platform === 'win32' });
process.on('exit', () => cms.kill());
process.on('SIGINT', () => process.exit());

// gera o site de novo quando o painel salva algo
let espera;
for (const pasta of ['content', 'assets/events']) {
  fs.watch(path.join(RAIZ, pasta), { recursive: true }, (_, nome) => {
    if (nome && nome.startsWith('opt')) return;
    clearTimeout(espera);
    espera = setTimeout(() => { console.log('\nAlteração no painel: gerando o site...'); gerar(); }, 400);
  });
}

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.includes('..')) { res.writeHead(400); return res.end(); }
  let f = path.join(RAIZ, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(308, { Location: p + '/' }); return res.end(); }
    f = path.join(f, 'index.html');
  }
  if (!fs.existsSync(f)) { res.writeHead(404, { 'Content-Type': TIPOS['.html'] }); return res.end(fs.readFileSync(path.join(RAIZ, '404.html'))); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORTA, () => console.log(`\nSite:   http://localhost:${PORTA}\nPainel: http://localhost:${PORTA}/admin/  (clique em "Entrar" / "Login", sem senha)\n`));
