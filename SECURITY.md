# Política de Segurança — Claritas
# Security Policy — Claritas

**Mantenedora / Maintainer:** Brenda Tavares (ShipClaw)
**Última auditoria / Last audit:** 2026-09-16
**Status:** Ativo / Active

---

## Princípios de Segurança
## Security Principles

O Claritas adota uma abordagem de **defesa em profundidade** com as seguintes garantias:
Claritas adopts a **defense-in-depth** approach with the following guarantees:

### 1. Isolamento de Credenciais / Credential Isolation
- Nenhuma chave de API está hardcoded no código / No API key is hardcoded in the code
- A chave de API é armazenada exclusivamente como variável de ambiente no provedor de deploy / The API key is stored exclusively as an environment variable in the deploy provider
- O navegador nunca recebe credenciais sensíveis / The browser never receives sensitive credentials

### 2. Sanitização de Código / Code Sanitization
- Zero `eval()` em todo o código / Zero `eval()` anywhere in the code
- Zero `innerHTML` — toda saída dinâmica usa `textContent` + `appendChild` / Zero `innerHTML` — all dynamic output uses `textContent` + `appendChild`
- Zero `document.write()` / Zero `document.write()`
- CSP em duas camadas: meta tag (diretivas de carregamento) + `site/_headers` com `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e `Referrer-Policy: no-referrer` (headers HTTP reais) / Two-layer CSP: meta tag (loading directives) + `site/_headers` with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` (real HTTP headers)
- `script-src` sem `'unsafe-inline'` e sem `'unsafe-hashes'`: o cliente está em `site/app.js` e os 28 handlers `onclick` viraram atributos `data-*` lidos por um listener delegado. `style-src` ainda tem `'unsafe-inline'` (66 atributos `style=""` e um bloco `<style>`) / `script-src` with no `'unsafe-inline'` and no `'unsafe-hashes'`: the client lives in `site/app.js` and the 28 `onclick` handlers became `data-*` attributes read by one delegated listener. `style-src` still carries `'unsafe-inline'` (66 `style=""` attributes and one `<style>` block)

### 3. Defesa contra Prompt Injection / Prompt Injection Defense
- System prompt de segurança prefixado em toda chamada à OpenRouter / Security system prompt prefixed on every OpenRouter call
- Recusa de geração de: armas, malware, exploits, phishing, fraude, CSAM, doxxing / Refusal to generate: weapons, malware, exploits, phishing, fraud, CSAM, doxxing
- Dados sensíveis (CPF, senhas, tokens) jamais são ecoados em respostas / Sensitive data (CPF, passwords, tokens) is never echoed in responses

### 4. Limitação de Recursos / Resource Limiting
- Rate limit: 30 requisições por minuto + 300 por dia por IP, com bloqueio automático de 24h acima de 120/min / Rate limit: 30 requests per minute + 300 per day per IP, with automatic 24-hour block above 120/min
- Tamanho máximo de mensagem: 20.000 caracteres / Maximum message size: 20,000 characters
- Máximo de mensagens por chamada: 50 / Maximum messages per call: 50
- Teto de saída por chamada: `max_tokens: 2048` / Per-call output cap: `max_tokens: 2048`
- Allowlist de modelos: apenas modelos OpenRouter free confirmados / Model allowlist: only confirmed OpenRouter free models
- Budget mensal OpenRouter: configurado pela mantenedora (não público) / Monthly OpenRouter budget: configured by the maintainer (not public)

### 5. Monitoramento Contínuo / Continuous Monitoring
- Zero dependências npm (projeto zero-build) — sem superfície de supply chain para auditar / Zero npm dependencies (zero-build project) — no supply-chain surface to audit
- Auditoria de segurança antes de cada commit / Security audit before each commit
- Revisão da allowlist de modelos OpenRouter a cada ciclo de deploy / OpenRouter model-allowlist review each deploy cycle

### 6. Rigor por Critério — OWASP Top 10 para LLMs / Rigor by Criteria — OWASP Top 10 for LLMs

| Critério / Criterion | Status | Controle / Control |
|---|---|---|
| LLM01 — Prompt Injection | Ativo / Active | Allowlist `ALLOWED_PERSONAS` no servidor; o system prompt é resolvido server-side a partir da chave enviada; toda mensagem `system` vinda do cliente é descartada antes da chamada; delimitadores `<INPUT>` no simulador e estimador / Server-side `ALLOWED_PERSONAS` allowlist; the system prompt is resolved server-side from the submitted key; every client-sent `system` message is discarded before the call; `<INPUT>` delimiters in the simulator and estimator |
| LLM02 — Sensitive Information Disclosure | Ativo / Active | Chave de API exclusivamente em variável de ambiente no provedor de deploy; regra de não-ecoar dados sensíveis no prompt; `Referrer-Policy: no-referrer`; prompts do projeto real **ausentes** deste repositório (ver LLM07) / API key exclusively in a deploy-provider environment variable; no-sensitive-data-echo rule in the prompt; `Referrer-Policy: no-referrer`; the real project prompts are **absent** from this repository (see LLM07) |
| LLM03 — Supply Chain | Ativo (reduzido) / Active (reduced) | Zero dependências npm; allowlist de modelos OpenRouter free; única dependência externa é Google Fonts (coberta pela CSP) / Zero npm dependencies; OpenRouter free-model allowlist; the only external dependency is Google Fonts (covered by CSP) |
| LLM04 — Data and Model Poisoning | Ativo (reduzido) / Active (reduced) | Knowledge base não-RAG, estática e controlada pelo servidor; nenhuma ingestão de dados de usuário em conhecimento persistente / Non-RAG, static, server-controlled knowledge base; no user-data ingestion into persistent knowledge |
| LLM05 — Improper Output Handling | Ativo / Active | Zero `innerHTML`/`eval`/`document.write`; saída renderizada apenas com `textContent` + `appendChild`; guarda client-side de 32k caracteres / Zero `innerHTML`/`eval`/`document.write`; output rendered only via `textContent` + `appendChild`; 32k-character client-side guard |
| LLM06 — Excessive Agency | Ativo (reduzido) / Active (reduced) | Sem tools/function calling; a saída da IA nunca dispara ações; conversa do Playground trava até "Limpar conversa" / No tools/function calling; AI output never triggers actions; Playground conversation locks until "Clear conversation" |
| LLM07 — System Prompt Leakage | Ativo, com limite declarado / Active, with a declared limit | O prompt vive só no servidor (`functions/api/prompts.js`) e o navegador envia apenas a chave; o filtro anti-eco no `chat.js` trunca/mascara respostas que ecoam verbatim o prompt injetado, com fingerprints derivadas em runtime. **Limite honesto:** num repositório público o código é legível, então isto não é sigilo de código-fonte — é proteção contra o *cliente* injetar e contra o *modelo* ecoar. Os prompts aqui são EXEMPLOS que divergem do projeto publicado. Sigilo real exige repositório privado / The prompt lives only on the server (`functions/api/prompts.js`) and the browser sends just the key; the anti-echo filter in `chat.js` truncates/masks responses that echo the injected prompt, with fingerprints derived at runtime. **Honest limit:** in a public repository the code is readable, so this is not source-code secrecy — it protects against the *client* injecting and the *model* echoing. The prompts here are EXAMPLES that diverge from the published project. Real secrecy requires a private repository |
| LLM08 — Vector and Embedding Weaknesses | N/A | Sem RAG, embeddings ou bases vetoriais — não há superfície explorável / No RAG, embeddings, or vector stores — no attack surface |
| LLM09 — Misinformation | Ativo / Active | Regras de veracidade no preamble (nunca inventar fatos; admitir estimativas); estimador assume margem de erro (±10-15%); detecção de resposta evasiva/verbosa no Playground / Veracity rules in the preamble (never invent facts; admit estimates); estimator declares ±10-15% margin; evasive/verbose detection in the Playground |
| LLM10 — Unbounded Consumption | Ativo / Active | Rate limit 30 req/min + 300 req/dia + bloqueio 24h; máx. 50 mensagens e 20k chars/mensagem; body ≤ 256KB; `max_tokens: 2048` por chamada; guarda de saída de 32k chars / Rate limit 30 req/min + 300 req/day + 24h block; max 50 messages and 20k chars/message; body ≤ 256KB; `max_tokens: 2048` per call; 32k-char output guard |

> **Nota de arquitetura / Architecture note:** os system prompts ficam em `functions/api/prompts.js`, no servidor — nunca no bundle do cliente. O navegador envia apenas a chave da persona (`"technical"`), validada contra uma allowlist, e o `chat.js` descarta qualquer mensagem `system` enviada pelo cliente antes de montar a chamada. Os prompts deste arquivo são **EXEMPLOS** escritos para explicar a arquitetura: eles divergem de propósito dos prompts do projeto publicado, que não existem neste repositório. Para usar este código, substitua os blocos `EXAMPLE_*` pelo seu prompt / The system prompts live in `functions/api/prompts.js`, on the server — never in the client bundle. The browser sends only the persona key (`"technical"`), validated against an allowlist, and `chat.js` discards any client-sent `system` message before building the call. The prompts in that file are **EXAMPLES** written to explain the architecture: they deliberately diverge from the published project's prompts, which are not present in this repository. To use this code, replace the `EXAMPLE_*` blocks with your own prompt.

---

## Versões / Versions

- **v2.16.0 (2026-10-02):** Prompts movidos para o servidor e removidos do repositório. `functions/api/prompts.js` resolve a persona a partir da chave validada contra `ALLOWED_PERSONAS`; o `chat.js` descarta toda mensagem `system` do cliente; o `index.html` deixou de construir o system prompt e passou a enviar só a chave. Os prompts que aqui aparecem são `EXAMPLE_*`, escritos para explicar a arquitetura e deliberadamente divergentes dos prompts do projeto publicado — um check no repositório privado falha se o texto real reaparecer aqui (ele precisa comparar os dois lados, então não roda neste repositório, que não tem acesso aos prompts reais). A tabela OWASP deixou de ser prosa: `npm run check:owasp` confere cada critério contra o código e falha se a documentação citar um identificador que não existe mais. LLM07 passou de "Demo" para "Ativo, com limite declarado" — o limite sendo que repositório público não é sigilo de código-fonte / Prompts moved server-side and removed from the repository. `functions/api/prompts.js` resolves the persona from the key validated against `ALLOWED_PERSONAS`; `chat.js` discards every client `system` message; `index.html` no longer builds the system prompt and sends only the key. The prompts shipped here are `EXAMPLE_*`, written to explain the architecture and deliberately divergent from the published project's prompts — a check in the private repository fails if the real text reappears here (it has to compare both sides, so it does not run in this repository, which has no access to the real prompts). The OWASP table is no longer prose: `npm run check:owasp` checks each criterion against the code and fails if the docs cite an identifier that no longer exists. LLM07 moved from "Demo" to "Active, with a declared limit" — the limit being that a public repository is not source-code secrecy.

- **v2.10.1 (2026-09-16):** Filtro de saída anti-eco (OWASP LLM07) — `chat.js` (paridade com o site) trunca e mascara respostas que ecoam verbatim as mensagens `system` enviadas pelo app, com fingerprints derivadas dos próprios prompts (stream com buffer de retardo de 512 chars e não-stream JSON) / Output anti-echo filter (OWASP LLM07) — `chat.js` (site parity) truncates and masks responses that echo the app-sent `system` messages verbatim, using fingerprints derived from the prompts (stream with a 512-char deferral buffer and non-stream JSON)

- **v2.10.0 (2026-09-16):** Auditoria OWASP LLM Top 10 (paridade com o site) — cap de saída `max_tokens: 2048` por chamada; marcadores de delimitação anti-prompt-injection no simulador/estimador; guarda de saída client-side (32k chars); regras de veracidade no preamble e personas; `maxlength` nos campos de entrada / OWASP LLM Top 10 audit (site parity) — per-call `max_tokens: 2048` cap; anti-prompt-injection delimiter markers in the simulator/estimator; client-side output guard (32k chars); veracity rules in the preamble and personas; `maxlength` on input fields

- **v2.9.2 (2026-09-14):** Personas de diálogo classificadas com anti-vazamento (nunca revelar system prompt/persona/regras); knowledge base injetada como não-RAG na composição do prompt do servidor; detetor de resposta verbosa re-escopado ao Arquiteto de Prompts (RACE) via `personaKey` / Classified dialogue personas with anti-leak (never reveal system prompt/persona/rules); injected non-RAG knowledge base in the server-side prompt composition; verbose-response detector rescoped to the Prompt Architect (RACE) via `personaKey`
- **v2.9.1 (2026-09-14):** Detecção de resposta verbosa sem Markdown no Playground (frontend, >150 chars sem marcadores); bloco `# FORMATO DE SAÍDA` obrigatório aplicado às personas server-side / Verbose non-Markdown response detection in the Playground (frontend, >150 chars with no markers); mandatory `# OUTPUT FORMAT` block applied to server-side personas *(bloco revertido na v2.9.2 / block reverted in v2.9.2)*
- **v2.9 (2026-09-12):** Prompts de persona destacados como EXEMPLO reproduzível no portfólio; proxy endurecido com rate limit KV (30/min + 300/dia + bloqueio 24h), kill switch, CORS restrito e fallback enxuto / Persona prompts highlighted as reproducible EXAMPLES in the portfolio; hardened proxy with KV rate limiting (30/min + 300/day + 24h block), kill switch, restricted CORS and lean fallback
- **v2.8 (2026-09-12):** Personas com saída profissional em Markdown; Playground travado até limpar conversa; badge de vocação por modelo; arquitetura documentada como não-RAG / Professional Markdown-output personas; Playground locked until conversation cleared; per-model skill badges; architecture documented as non-RAG
- **v2.7 (2026-09-11):** CSP em duas camadas com headers HTTP reais via `site/_headers` / Two-layer CSP with real HTTP headers via `site/_headers`
- **v2.4 (2026-07-19):** Política de segurança formalizada / Formalized security policy

---

## Copyright

© 2026 ShipClaw · Claritas — Mantido por Brenda Tavares / Maintained by Brenda Tavares