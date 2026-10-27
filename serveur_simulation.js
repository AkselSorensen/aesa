const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = 8765;
const HOST = '127.0.0.1';
const htmlPath = path.join(ROOT, 'simulation_radar_aesa.html');

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try { return send(res, 200, fs.readFileSync(htmlPath, 'utf8'), 'text/html; charset=utf-8'); }
    catch { return send(res, 500, 'Fichier HTML introuvable.', 'text/plain; charset=utf-8'); }
  }
  if (req.method === 'GET' && req.url === '/api/status') return send(res, 200, { ready: true });
  if (req.method !== 'POST' || req.url !== '/api/analyze') return send(res, 404, { error: 'Route inconnue.' });

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 30000) { req.destroy(); return; }
  }
  let payload;
  try { payload = JSON.parse(raw); } catch { return send(res, 400, { error: 'Données de simulation invalides.' }); }
  const model = typeof payload.model === 'string' && /^[a-zA-Z0-9:._/-]{1,80}$/.test(payload.model) ? payload.model : 'qwen3.5:4b';
  try {
    async function askAgent(instructions, input) {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: JSON.stringify(input) }
        ], format: 'json', stream: false, think: false, keep_alive: '10m', options: { temperature: 0.2, num_predict: 384 } }),
        signal: AbortSignal.timeout(120000)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Erreur renvoyée par Ollama.');
      const text = body.message?.content || '';
      if (!text) throw new Error('Le modèle n’a pas renvoyé de résultat texte.');
      try { return JSON.parse(text); }
      catch { throw new Error(`Le modèle a renvoyé un JSON incomplet : ${text.slice(-120)}`); }
    }
    const observations = payload.observations ?? {};
    const base = 'Tu es un agent spécialisé dans une simulation fictive, pédagogique et civile. Les mesures sont inventées et ne justifient aucune action réelle. N’invente ni identité ni menace. Réponds uniquement avec un JSON valide contenant observation, action et confiance. Fais chaque champ très court : une phrase, moins de 100 caractères.';
    const roles = [
      ['militaire', `${base} Ton rôle militaire est limité à l’observation pédagogique des pistes, de leur évolution et des incertitudes. Aucune tactique, cible ou consigne d’intervention.`],
      ['commercial', `${base} Ton rôle commercial/civil est de relever des conflits de circulation fictifs et suggérer une vérification ou une coordination civile.`],
      ['aviaire', `${base} Ton rôle aviaire est de repérer des signatures éventuellement compatibles avec des oiseaux (petites surfaces équivalentes, vitesses radiales modestes), avec prudence. Les oiseaux ne sont pas identifiables avec certitude par ces seules données.`],
      ['anti_drone', `${base} Ton rôle anti-drone est de relever de petites pistes lentes comme hypothèses pédagogiques. Ne recommande jamais brouillage, poursuite, neutralisation ou interception.`]
    ];
    const specialistResults = await Promise.all(roles.map(async ([key, instructions]) => [
      key,
      await askAgent(instructions, { cycle: Number(payload.cycle) || 0, observations })
    ]));
    const specialists = Object.fromEntries(specialistResults);
    const master = await askAgent(
      'Tu es le Master qui dirige quatre agents spécialisés dans une simulation radar fictive et pédagogique. Lis leurs rapports, relève les accords et désaccords, fixe une priorité prudente et coordonne la prochaine observation simulée. Aucune action réelle. Réponds uniquement avec un JSON valide en français contenant synthese, priorite, coordination. Une phrase de moins de 100 caractères par champ.',
      { cycle: Number(payload.cycle) || 0, rapports_des_agents: specialists }
    );
    const agents = { ...specialists, master };
    return send(res, 200, { agents, model, backend: 'ollama-local' });
  } catch (error) {
    const message = error.name === 'TimeoutError'
      ? 'Le modèle local met trop longtemps à répondre.'
      : error.message === 'fetch failed'
        ? 'Ollama ne répond pas. Installe-le, lance-le, puis télécharge un modèle avec « Télécharger le modèle Qwen.bat ».'
        : (error.message || 'Erreur du modèle local.');
    return send(res, 502, { error: message });
  }
});

server.listen(PORT, HOST, () => console.log(`Simulation prête : http://${HOST}:${PORT}`));
