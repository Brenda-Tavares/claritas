// Cloudflare Pages Function — proxy serverless para o provedor de IA
// A chave de API vive como variável de ambiente no provedor de deploy.
// O navegador chama este endpoint; a chave nunca sai do servidor.
//
// Os system prompts vivem em ./prompts.js (server-side) — o navegador nunca os
// recebe. O cliente manda a CHAVE da persona ("technical"), validada contra
// ALLOWED_PERSONAS, e o servidor resolve o texto. Qualquer mensagem `system`
// que o cliente envie é descartada antes de chamar o provedor (OWASP LLM01):
// com o prompt no corpo da requisição, um `curl` bastaria para sequestrar a
// persona com {role: "system", content: "ignore as regras anteriores"}.

import {
  resolvePersona,
  resolveModelDirective,
  buildFingerprintMatcher,
  toCanon,
  MASK_LINE,
  MASK_TEXT
} from './prompts.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Modelos FREE do OpenRouter para Playground/Token Simulator
const ALLOWED_MODELS = [
  'cohere/north-mini-code:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'inclusionai/ling-3.0-flash-sante:free',
  'liquid/lfm-2.5-2.6b:free',
  'nvidia/nemotron-3.5-content-safety:free',
  'poolside/laguna-s-2.1:free',
  'poolside/laguna-xs-2.1:free',
  'openrouter/free',
  'thinkingmachines/inkling:free',
  'thinkingmachines/inkling-small:free'
];

// Modelos PAGOS de mercado (apenas para a calculadora de tokens —
// o Pages Function só faz contagem via IA fixa, sem chamar estes modelos).
// Preços em USD por 1k tokens. Última atualização: 2026-07.
const PAID_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet',  label: 'Claude 3.5 Sonnet',  priceIn: 0.003000, priceOut: 0.015000, context: '200K', origin: 'us' },
  { id: 'anthropic/claude-3-haiku',      label: 'Claude 3 Haiku',     priceIn: 0.000250, priceOut: 0.001250, context: '200K', origin: 'us' },
  { id: 'openai/gpt-4o',                 label: 'GPT-4o',              priceIn: 0.002500, priceOut: 0.010000, context: '128K', origin: 'us' },
  { id: 'openai/gpt-4o-mini',            label: 'GPT-4o Mini',         priceIn: 0.000150, priceOut: 0.000600, context: '128K', origin: 'us' },
  { id: 'openai/gpt-4.1',                label: 'GPT-4.1',             priceIn: 0.002000, priceOut: 0.008000, context: '1M',   origin: 'us' },
  { id: 'google/gemini-2.0-flash',       label: 'Gemini 2.0 Flash',    priceIn: 0.000100, priceOut: 0.000400, context: '1M',   origin: 'us' },
  { id: 'deepseek/deepseek-chat',        label: 'DeepSeek V3',         priceIn: 0.000140, priceOut: 0.000280, context: '64K',  origin: 'cn' },
  { id: 'qwen/qwen-2.5-72b-instruct',    label: 'Qwen 2.5 72B',         priceIn: 0.000400, priceOut: 0.000400, context: '128K', origin: 'cn' },
  { id: 'qwen/qwen-3-235b-a22b',         label: 'Qwen 3 235B A22B',     priceIn: 0.000300, priceOut: 0.000300, context: '128K', origin: 'cn' },
  { id: 'qwen/qwen-3-32b',               label: 'Qwen 3 32B',           priceIn: 0.000180, priceOut: 0.000180, context: '128K', origin: 'cn' },
  { id: 'qwen/qwen-3-72b',               label: 'Qwen 3 72B',           priceIn: 0.000290, priceOut: 0.000290, context: '128K', origin: 'cn' },
  { id: 'qwen/qwen-3.5-72b',             label: 'Qwen 3.5 72B',         priceIn: 0.000350, priceOut: 0.000350, context: '128K', origin: 'cn' },
  { id: 'qwen/qwen-3.6-plus',            label: 'Qwen 3.6 Plus',        priceIn: 0.000450, priceOut: 0.000450, context: '128K', origin: 'cn' },
  { id: 'qwen/qwen-3.6-max',             label: 'Qwen 3.6 Max',         priceIn: 0.000900, priceOut: 0.000900, context: '256K', origin: 'cn' },
  { id: 'qwen/qwen-3.7-plus',            label: 'Qwen 3.7 Plus',        priceIn: 0.000600, priceOut: 0.000600, context: '256K', origin: 'cn' },
  { id: 'qwen/qwen-3.7-max',             label: 'Qwen 3.7 Max',         priceIn: 0.001200, priceOut: 0.001200, context: '256K', origin: 'cn' },
  { id: 'qwen/qwen-3.8-max',             label: 'Qwen 3.8 Max',         priceIn: 0.001800, priceOut: 0.001800, context: '512K', origin: 'cn' },
  { id: 'z-ai/glm-4.5',                  label: 'Z.AI GLM 4.5',         priceIn: 0.000300, priceOut: 0.000300, context: '128K', origin: 'cn' },
  { id: 'z-ai/glm-4.6',                  label: 'Z.AI GLM 4.6',         priceIn: 0.000350, priceOut: 0.000350, context: '200K', origin: 'cn' },
  { id: 'meta-llama/llama-3.1-70b',      label: 'Llama 3.1 70B',       priceIn: 0.000590, priceOut: 0.000790, context: '128K', origin: 'us' },
  { id: 'meta-llama/llama-3.1-405b',     label: 'Llama 3.1 405B',      priceIn: 0.002000, priceOut: 0.002000, context: '128K', origin: 'us' }
];

// Rate limit: TETO.MIN, TETO.DIA por IP, BLOQUEIO.AUTO e janela
const RATE_LIMIT_MAX_MIN = 30;        // 30 req/min por IP
const RATE_LIMIT_MAX_DAY = 300;       // 300 req/dia por IP
const RATE_LIMIT_AUTO_BLOCK = 120;    // acima disso em 1 min => bloqueio 24h
const BLOCK_TTL_SECONDS = 86_400;     // 24h
const DAY_TTL_SECONDS = 172_800;      // 48h
const MAX_BODY_BYTES = 256 * 1024;    // limite de tamanho do body
const MAX_OUTPUT_TOKENS = 2048;       // teto de saida por chamada (evita consumo descontrolado)
// O Arquiteto de Prompts recebe teto maior, e nao por luxo: o entregavel dele e
// um prompt para outra IA, e prompt de codigo com listas e blocos de exemplo
// estoura 2048 tokens antes de sair. Os outros OutputCard sao conversa ou
// medicao, onde 2048 ja sobra.
const MAX_OUTPUT_TOKENS_ARQUITETO = 6144;

// Rate limit local (fallback se o KV não estiver configurado)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60_000;

function getClientIP(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

function nowMinute() {
  return Math.floor(Date.now() / 60_000);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function makeRlHeaders(retryAfterSeconds) {
  return { 'Retry-After': String(retryAfterSeconds) };
}

// Contador crédito-por-IP em KV (se binding RATE_LIMIT_KV existir) ou memória (fallback).
async function checkRateLimit(request, env) {
  const ip = getClientIP(request);
  const kv = env.RATE_LIMIT_KV;

  if (!kv) {
    const now = Date.now();
    const entry = rateLimit.get(ip);
    if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
      rateLimit.set(ip, { start: now, count: 1, day: todayKey(), dayCount: 1 });
      return { allowed: true, ip };
    }
    entry.count += 1;
    if (entry.day !== todayKey()) { entry.day = todayKey(); entry.dayCount = 0; }
    entry.dayCount += 1;
    if (entry.count > RATE_LIMIT_AUTO_BLOCK) {
      return { allowed: false, retryAfter: 86_400, ip, blocked: true };
    }
    if (entry.count > RATE_LIMIT_MAX_MIN || entry.dayCount > RATE_LIMIT_MAX_DAY) {
      return { allowed: false, retryAfter: 60, ip };
    }
    return { allowed: true, ip };
  }

  const minKey = `rl:min:${ip}:${nowMinute()}`;
  const dayKey = `rl:day:${ip}:${todayKey()}`;
  const blockKey = `rl:block:${ip}`;

  try {
    const [blocked, minCount, dayCount] = await Promise.all([
      kv.get(blockKey),
      kv.get(minKey, 'json'),
      kv.get(dayKey, 'json')
    ]);

    if (blocked !== null) {
      return { allowed: false, retryAfter: 86_400, ip, blocked: true };
    }

    const min = (minCount && minCount.count) || 0;
    const day = (dayCount && dayCount.count) || 0;
    const minNext = min + 1;
    const dayNext = day + 1;

    if (minNext > RATE_LIMIT_AUTO_BLOCK) {
      await kv.put(blockKey, '1', { expirationTtl: BLOCK_TTL_SECONDS });
      return { allowed: false, retryAfter: 86_400, ip, blocked: true };
    }

    await kv.put(minKey, JSON.stringify({ count: minNext }), { expirationTtl: 120 });
    if (dayNext === 1 || dayNext % 10 === 0) {
      await kv.put(dayKey, JSON.stringify({ count: dayNext }), { expirationTtl: DAY_TTL_SECONDS });
    }

    if (minNext > RATE_LIMIT_MAX_MIN || dayNext > RATE_LIMIT_MAX_DAY) {
      return { allowed: false, retryAfter: 60, ip };
    }
    return { allowed: true, ip };
  } catch (err) {
    return { allowed: true, ip };
  }
}

function isLocalOrigin(origin) {
  if (!origin) return false;
  return /^https?:\/\/localhost(:\d+)?$/.test(origin);
}

// CORS: só libera as origens do próprio site + localhost. Origem desconhecida não recebe header.
function corsHeaders(request, extra) {
  const headers = new Headers(extra || {});
  const origin = request.headers.get('Origin') || '';
  const selfOrigin = new URL(request.url).origin;
  if (origin && (origin === selfOrigin || isLocalOrigin(origin))) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  // Header customizado precisa ser exposto explicitamente para o JS de outra
  // origem poder lê-lo; sem isso, X-Claritas-Model só existe para o mesmo
  // origem e o aviso de modelo substituto some no preview local.
  headers.set('Access-Control-Expose-Headers', 'X-Claritas-Model');
  return headers;
}

function jsonError(status, message, request, retryAfter) {
  const headers = corsHeaders(request, { 'Content-Type': 'application/json' });
  if (retryAfter) {
    Object.entries(makeRlHeaders(retryAfter)).forEach(([k, v]) => headers.set(k, v));
  }
  return new Response(JSON.stringify({ error: { message } }), { status, headers });
}

function corsPreflight(request) {
  const headers = corsHeaders(request);
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}

function isValidModel(model) {
  return typeof model === 'string' && ALLOWED_MODELS.includes(model);
}

// Personas aceitas — as chaves que o cliente pode pedir. O texto de cada uma
// vive em ./prompts.js. Uma chave fora desta lista nunca resolve para prompt
// nenhum: é esta allowlist, e não o `|| 'default'` do resolvePersona, que
// impede o cliente de escolher uma persona arbitrária.
const ALLOWED_PERSONAS = ['default', 'technical', 'creative', 'prompt-engineer', 'optimizer', 'estimator'];

function isValidPersona(persona) {
  return typeof persona === 'string' && ALLOWED_PERSONAS.includes(persona);
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

function getReferer(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin;
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

// Idioma de resposta (Fase i18n): sempre autorado no servidor, nunca ecoado do body.
// Valores restritos a constante fixa — qualquer outro valor cai no padrão 'pt'.
const DEFAULT_LANG = 'pt';
const LANG_DIRECTIVES = {
  pt: '\n\nIdioma de resposta: português do Brasil.',
  en: '\n\nResponse language: English.',
  zh: '\n\nResponse language: Simplified Chinese (简体中文).'
};

function normalizeLang(lang) {
  return (lang === 'en' || lang === 'zh') ? lang : DEFAULT_LANG;
}

function sseEvent(obj) {
  return 'data: ' + JSON.stringify(obj) + '\n\n';
}

function sanitizeSSE(body, matcher) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let pendingRaw = '';
  let forwardedCanon = '';
  let truncated = false;
  const MAX_DEFER = 512;

  return new ReadableStream({
    async start(controller) {
      const send = (chunk) => { if (chunk) controller.enqueue(encoder.encode(chunk)); };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const data = t.slice(5).trim();
            if (data === '[DONE]') continue;
            let delta = '';
            try {
              const parsed = JSON.parse(data);
              delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
            } catch {
              continue;
            }
            if (!delta || truncated) continue;
            pendingRaw += delta;
            if (matcher && matcher.test(forwardedCanon.slice(-512) + ' ' + toCanon(pendingRaw))) {
              truncated = true;
              pendingRaw = '';
              send(sseEvent({ choices: [{ delta: { content: MASK_TEXT } }] }));
              continue;
            }
            const surplus = pendingRaw.length - MAX_DEFER;
            if (surplus > 0) {
              const safe = pendingRaw.slice(0, surplus);
              send(sseEvent({ choices: [{ delta: { content: safe } }] }));
              pendingRaw = pendingRaw.slice(surplus);
              forwardedCanon += toCanon(safe);
            }
          }
        }
        if (!truncated && pendingRaw) {
          send(sseEvent({ choices: [{ delta: { content: pendingRaw } }] }));
        }
        send('data: [DONE]\n\n');
        controller.close();
      } catch (e) {
        try { controller.error(e); } catch {}
      }
    }
  });
}

function sanitizeJSON(rawText, matcher) {
  let obj;
  try {
    obj = JSON.parse(rawText);
  } catch {
    return rawText;
  }
  const content = obj?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && matcher && matcher.test(toCanon(content))) {
    obj.choices[0].message.content = MASK_LINE;
  }
  return JSON.stringify(obj);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Kill switch: CHAT_KILL_SWITCH='true' derruba o proxy em 1 passo no dashboard
  if (env.CHAT_KILL_SWITCH === 'true') {
    return jsonError(503, 'Sistema em manutenção. Tente novamente em instantes.', request);
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonError(500, 'OPENROUTER_API_KEY não configurada no servidor.', request);
  }

  const limit = await checkRateLimit(request, env);
  if (!limit.allowed) {
    if (limit.blocked) {
      return jsonError(429, 'Acesso temporariamente bloqueado por suspeita de abuso. Tente novamente mais tarde.', request, limit.retryAfter);
    }
    return jsonError(429, 'Muitas requisições. Tente novamente em instantes.', request, limit.retryAfter);
  }

  if (request.headers.get('Content-Length')) {
    const len = parseInt(request.headers.get('Content-Length'), 10);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return jsonError(413, 'Requisição muito grande.', request);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Body JSON inválido.', request);
  }

  const { model, messages, stream, lang, persona } = body;

  // Validação ANTES de montar o prompt. A versão anterior compunha as
  // mensagens e só depois validava, ou seja, fazia trabalho e ainda montava
  // regex de fingerprint a partir de entrada já rejeitada.
  if (!isValidModel(model)) {
    return jsonError(400, 'Modelo não permitido.', request);
  }
  if (!isValidPersona(persona)) {
    return jsonError(400, 'Persona não permitida.', request);
  }
  if (!isValidMessages(messages)) {
    return jsonError(400, 'Mensagens inválidas (formato, quantidade ou tamanho).', request);
  }
  if (stream !== true && stream !== false) {
    return jsonError(400, 'Parâmetro "stream" deve ser true ou false.', request);
  }

  // ---- Injeção server-side (OWASP LLM01) --------------------------------
  // O system prompt vem do servidor, resolvido pela CHAVE que o cliente
  // mandou. O filter() é a parte que não é negociável: qualquer `system` do
  // cliente é removido da lista que vai ao provedor, então uma tentativa de
  // injeção some aqui em vez de chegar ao modelo.
  const personaSystem = resolvePersona(persona);
  // Persona de ferramenta (RACE/optimizer/estimator) tem regras próprias
  // rígidas e não recebe a diretiva por modelo. A detecção é pela CHAVE
  // validada acima — a versão anterior também sniffava o texto da persona
  // enviada pelo cliente, o que é deixar o cliente decidir o papel do servidor.
  const isToolPersona = ['prompt-engineer', 'optimizer', 'estimator'].includes(persona);
  const modelDirective = isToolPersona ? null : resolveModelDirective(model);
  const langDirective = LANG_DIRECTIVES[normalizeLang(lang)];
  const systemContent = personaSystem
    + (langDirective || '')
    + (modelDirective ? '\n\n---\n\n' + modelDirective : '');

  const effectiveMessages = [
    { role: 'system', content: systemContent },
    ...messages.filter(m => m.role !== 'system')
  ];

  // Filtro de saída: fingerprints derivados do system prompt que acabamos de
  // injetar, não do que o cliente mandou (OWASP LLM07).
  const matcher = buildFingerprintMatcher([systemContent]);

  // Fallback: modelo solicitado + até 2 reservas da allowlist (evita amplificação 15x de gasto).
  const candidates = [model, ...ALLOWED_MODELS.filter(m => m !== model)].slice(0, 3);

  for (const candidate of candidates) {
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': getReferer(request) || 'https://openrouter.ai',
        'X-Title': 'Claritas Playground'
      },
      body: JSON.stringify({
        model: candidate,
        messages: effectiveMessages,
        stream,
        max_tokens: persona === 'prompt-engineer' ? MAX_OUTPUT_TOKENS_ARQUITETO : MAX_OUTPUT_TOKENS
      })
    });

    if (upstream.ok && upstream.body) {
      const headers = new Headers();
      headers.set('Content-Type', 'text/event-stream; charset=utf-8');
      headers.set('Cache-Control', 'no-cache, no-transform');
      headers.set('Connection', 'keep-alive');
      const origin = request.headers.get('Origin') || '';
      if (origin && (origin === new URL(request.url).origin || isLocalOrigin(origin))) {
        headers.set('Access-Control-Allow-Origin', origin);
      }
      // Qual modelo ATENDEU. Sem isto, o fallback das 3 tentativas e invisivel:
      // o cliente recebe 200 com o stream de outro modelo e nao tem como saber.
      headers.set('X-Claritas-Model', candidate);
      headers.set('Access-Control-Expose-Headers', 'X-Claritas-Model');
      if (stream) {
        return new Response(sanitizeSSE(upstream.body, matcher), { status: 200, headers });
      }
      const rawText = await upstream.text();
      return new Response(sanitizeJSON(rawText, matcher), {
        status: 200,
        headers: corsHeaders(request, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Claritas-Model': candidate
        })
      });
    }
  }

  return jsonError(502, 'Todos os modelos temporariamente indisponíveis. Tente novamente em alguns instantes.', request);
}

export async function onRequestGet(context) {
    const { request, env } = context;
    // Retorna a lista de modelos free + pagos (públicos, sem credenciais)
    return new Response(
        JSON.stringify({
            free: ALLOWED_MODELS,
            paid: PAID_MODELS.map(m => ({
                id: m.id,
                label: m.label,
                priceIn: m.priceIn,
                priceOut: m.priceOut,
                context: m.context,
                origin: m.origin
            }))
        }),
        {
            status: 200,
            headers: corsHeaders(request, {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600'
            })
        }
    );
}

export async function onRequestOptions(context) {
    return corsPreflight(context.request);
}
