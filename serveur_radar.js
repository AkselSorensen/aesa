const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 8765;
const HOST = process.env.HOST || '127.0.0.1';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const PUBLIC = path.join(__dirname, 'public');
const PAGES = {
  '/': 'radar_ville_3d.html',
  '/reunion': 'radar_agents_reunion_3d.html'
};
const MAX_BODY = 60000;

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

// Relais vers Ollama : seules les routes utilisées par la page sont autorisées.
async function proxyOllama(req, res, url) {
  const upstream = url.replace(/^\/ollama/, '');
  const allowed = (req.method === 'GET' && upstream === '/api/tags') || (req.method === 'POST' && upstream === '/api/chat');
  if (!allowed) return send(res, 404, 'Route inconnue.');

  let body = '';
  if (req.method === 'POST') {
    for await (const chunk of req) {
      body += chunk;
      if (body.length > MAX_BODY) { req.destroy(); return; }
    }
  }
  try {
    const response = await fetch(`${OLLAMA_URL}${upstream}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? body : undefined,
      signal: AbortSignal.timeout(120000)
    });
    const text = await response.text();
    send(res, response.status, text, 'application/json; charset=utf-8');
  } catch {
    send(res, 502, JSON.stringify({ error: 'Ollama injoignable depuis le serveur.' }), 'application/json; charset=utf-8');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local').pathname;
  if (url.startsWith('/ollama/')) return proxyOllama(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non autorisée.');

  const file = PAGES[url] || (url.endsWith('.html') ? url.slice(1) : null);
  if (!file || file.includes('/') || file.includes('..')) return send(res, 404, 'Page introuvable.');
  try {
    const html = fs.readFileSync(path.join(PUBLIC, file), 'utf8');
    send(res, 200, html, 'text/html; charset=utf-8');
  } catch {
    send(res, 404, 'Page introuvable.');
  }
});

server.listen(PORT, HOST, () => console.log(`Radar prêt : http://${HOST}:${PORT}  (Ollama : ${OLLAMA_URL})`));
