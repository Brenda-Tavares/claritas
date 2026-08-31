// Cloudflare Pages Function — proxy para OpenRouter
// A chave OPENROUTER_API_KEY é configurada como variável de ambiente no Cloudflare Pages
// (Settings → Environment variables → Production).
// O navegador chama este endpoint; a chave nunca sai do servidor.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ALLOWED_MODELS = [
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free'
];

// Rate limit simples por IP (em memória — não persiste entre invocações em produção real)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minuto
const RATE_LIMIT_MAX = 30;        // 30 req/min por IP

function getClientIP(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

function isValidModel(model) {
  return typeof model === 'string' && ALLOWED_MODELS.includes(model);
}

function isValidMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) return false;
  for (const m of messages) {
    if (!m || typeof m !== 'object') return false;
    if (m.role !== 'system' && m.role !== 'user' && m.role !== 'assistant') return false;
    if (typeof m.content !== 'string' || m.content.length > 20000) return false;
  }
  return true;
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError(500, 'OPENROUTER_API_KEY não configurada no servidor.');
  }

  const ip = getClientIP(request);
  if (!checkRateLimit(ip)) {
    return jsonError(429, 'Muitas requisições. Tente novamente em 1 minuto.');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Body JSON inválido.');
  }

  const { model, messages, stream } = body;

  if (!isValidModel(model)) {
    return jsonError(400, 'Modelo não permitido.');
  }
  if (!isValidMessages(messages)) {
    return jsonError(400, 'Mensagens inválidas (formato, quantidade ou tamanho).');
  }
  if (stream !== true && stream !== false) {
    return jsonError(400, 'Parâmetro "stream" deve ser true ou false.');
  }

  const upstream = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': new URL(request.url).origin,
      'X-Title': 'Claritas'
    },
    body: JSON.stringify({ model, messages, stream })
  });

  if (!upstream.ok || !upstream.body) {
    let errText = '';
    try { errText = await upstream.text(); } catch {}
    return jsonError(upstream.status || 502, 'OpenRouter: ' + (errText || upstream.statusText));
  }

  // Repassa o stream SSE upstream → cliente
  const headers = new Headers();
  headers.set('Content-Type', 'text/event-stream; charset=utf-8');
  headers.set('Cache-Control', 'no-cache, no-transform');
  headers.set('Connection', 'keep-alive');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(upstream.body, { status: 200, headers });
}

export async function onRequestGet() {
  return jsonError(405, 'Use POST.');
}

export async function onRequestOptions() {
  return corsPreflight();
}
