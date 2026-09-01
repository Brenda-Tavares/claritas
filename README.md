# Claritas

> Portal técnico de Engenharia de Prompt e Documentação Markdown.
> Technical portal for Prompt Engineering and Markdown Documentation.
>
> Projeto portfólio — **Brenda Tavares** (ShipClaw).

---

## 🇧🇷 Visão Geral

Claritas é um portal de documentação sênior que une **Markdown** (sintaxe universal para documentação técnica) e **Engenharia de Prompt** (comunicação estruturada com modelos de linguagem), com fundamentação em especificações oficiais (CommonMark, GFM) e literatura acadêmica (Wei et al., Phoenix & Corbin, Winters et al.).

Construído sob política **zero-build, zero-dependency** — o HTML abre diretamente no navegador, sem compilação, sem bundlers, sem runtime JavaScript externo.

## 🇬🇧 Overview

Claritas is a senior documentation portal that combines **Markdown** (universal syntax for technical documentation) and **Prompt Engineering** (structured communication with language models), grounded in official specifications (CommonMark, GFM) and academic literature (Wei et al., Phoenix & Corbin, Winters et al.).

Built under a **zero-build, zero-dependency** policy — the HTML opens directly in the browser, no compilation, no bundlers, no external JavaScript runtime.

---

## Stack Tecnológica / Tech Stack

| Camada / Layer | Tecnologia / Technology | Frameworks |
|--------|-----------|------------|
| **Frontend** | HTML5 Semântico + CSS3 Puro + JavaScript Vanilla ES6+ | Zero frameworks JS |
| **Design** | CSS Grid, Flexbox, Variáveis CSS (`:root`), Custom Properties | Zero bibliotecas CSS |
| **Tipografia / Typography** | Inter (body) + Playfair Display (headings) via Google Fonts | Única dependência externa / Only external dependency |
| **Backend (API)** | Cloudflare Pages Functions | Vanilla (sem framework) |
| **Streaming** | Server-Sent Events (SSE) via TransformStream | Native to Workers |
| **Modelo de IA / AI Model** | OpenRouter via Pages Function (8 modelos free: M3, M2.7, Nemotron Super 120B, Nemotron Nano 30B, Nemotron Ultra 550B, Z.AI GLM 5.2, Cohere North Mini, Poolside Laguna XS 2.1) | Gratuito / Free tier |
| **Deploy** | Cloudflare Pages (site + Functions) | Zero build local / Local zero build |
| **Segurança / Security** | Content-Security-Policy, X-Frame-Options, Referrer-Policy | Meta tags + HTTP headers |
| **Controle / Version Control** | Git + GitHub | — |

### Linguagens / Languages

- **HTML5** — 100% semântico / semantic (header, nav, main, section, footer, details, summary)
- **CSS3** — Grid layouts, Flexbox, animações keyframe, media queries, prefers-reduced-motion
- **JavaScript ES6+** — SPA routing, IntersectionObserver / scroll tracking, SSE streaming, async/await
- **JavaScript** — Configuração da Pages Function (`functions/api/chat.js`)
- **JSON** — Pacotes npm e schemas de API / npm packages and API schemas

---

## Funcionalidades / Features

- **Roteador SPA** com Allowlist defensiva — 15 rotas validadas, fallback seguro para `#home`
- **Sidebar flutuante** com tracking de profundidade — item ativo em destaque, escala decrescente nos demais
- **Dark Mode** com persistência via `localStorage` — toggle claro/escuro
- **Playground de Prompt** — comparação lado a lado de 2-4 modelos do OpenRouter (SSE) com persona "Arquiteto de Prompts (RACE)" disponível
- **Token Simulator** — otimização profissional de prompts via framework RACE (modelo `m2.7`)
- **Contador de Tokens** — chama OpenRouter para obter `usage.prompt_tokens` e `usage.completion_tokens` reais
- **Footer 4 colunas** — navegação completa, links externos para CommonMark, GFM, Markdown Guide
- **Design responsivo** — desktop (1200px), tablet (768px), mobile (480px)
- **Acessibilidade** — prefers-reduced-motion, hierarquia visual, contraste WCAG AA

---

## Estrutura do Projeto / Project Structure

```
claritas/
├── site/
│   ├── index.html              # Portal completo (arquivo único)
│   ├── functions/
│   │   └── api/
│   │       └── chat.js         # Cloudflare Pages Function (proxy OpenRouter server-side)
│   └── assets/
│       ├── favicon-light.ico
│       ├── favicon-dark.ico
│       ├── icon-light.png
│       └── icon-dark.png
│
└── README.md                   # Este arquivo
```

---

## Execução Local / Getting Started

### 🇧🇷 Frontend (abertura direta)
Abra `site/index.html` no navegador. Nenhuma instalação necessária.

### 🇬🇧 Frontend (direct open)
Open `site/index.html` in your browser. No installation required.

### 🇧🇷 Servidor estático (para CSP)
```bash
cd site
python -m http.server 8080
```
Acesse `http://localhost:8080`

### 🇬🇧 Static server (for CSP)
```bash
cd site
python -m http.server 8080
```
Open `http://localhost:8080`

> 🇧🇷 O site e a API são deployados automaticamente via **Cloudflare Pages** conectado ao repositório GitHub. A chave do OpenRouter vai como **variável de ambiente** no painel do provedor de deploy.
> 🇬🇧 The site and API are automatically deployed via **Cloudflare Pages** connected to the GitHub repository. The OpenRouter key is stored as an **environment variable** in the deploy provider's dashboard.

---

## API (Cloudflare Pages Function)

### `POST /api/chat`
🇧🇷 Proxy server-side para OpenRouter. A chave fica em `env.OPENROUTER_API_KEY` (não no código).
🇬🇧 Server-side proxy to OpenRouter. The key is stored in `env.OPENROUTER_API_KEY` (not in the code).

**Request:**
```json
{
  "model": "minimax/minimax-m3:free",
  "messages": [
    { "role": "system", "content": "Você é um assistente..." },
    { "role": "user", "content": "Explique Markdown" }
  ],
  "stream": true
}
```

**Response:** 🇧🇷 Stream de tokens via SSE. / 🇬🇧 Token stream via SSE.

**Modelos permitidos** (allowlist no servidor): `minimax/minimax-m3`, `minimax/minimax-m2.7`, `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`, `nvidia/nemotron-3-ultra-550b-a55b`, `z-ai/glm-5.2`, `cohere/north-mini-code`, `poolside/laguna-xs-2.1` (todos `:free`).

**Rate limit:** 30 req/min por IP.

---

## Segurança / Security

### Content-Security-Policy
```
default-src 'self'
script-src 'self' 'unsafe-inline'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
img-src 'self' data:
connect-src 'self' http://localhost:*
frame-ancestors 'none'
base-uri 'self'
form-action 'none'
```

### 🇧🇷 Medidas implementadas / 🇬🇧 Implemented measures
- **Zero dependências externas** no frontend (exceto Google Fonts)
- **Zero `innerHTML`** com dados de usuário — toda saída dinâmica usa `textContent` + `appendChild`
- **Zero `eval()`** — CSP sem `'unsafe-eval'`
- **Zero CDN** — sem scripts de terceiros
- **Allowlist de rotas** — rejeição automática de rotas inválidas
- **Links externos** com `target="_blank" rel="noopener noreferrer"`
- **Nenhuma chave de API no código** — variáveis de ambiente do provedor de deploy, lidas server-side pela Pages Function

---

## Portfólio / Portfolio

Este projeto demonstra / This project demonstrates:

- **Arquitetura SPA zero-build** — HTML único que funciona sem servidor
- **Governança por prompt** — toda modificação passa por auditoria de 6 testes de estresse
- **Design system rigoroso** — paleta definida, dark mode, sem frameworks CSS
- **Streaming serverless** — SSE via Cloudflare Pages Function (proxy server-side para OpenRouter)
- **Segurança em camada única** — CSP como única barreira, sem backend próprio
- **UX com scroll tracking** — sidebar adaptativa com profundidade visual

---

## Licença / License

🇧🇷 Projeto de código aberto mantido por **Brenda Tavares** (ShipClaw).  
🇬🇧 Open source project maintained by **Brenda Tavares** (ShipClaw).

🇧🇷 Código-fonte livre para reuso educacional e base para portais de documentação, desde que mantidas as meta tags de segurança e removidas as referências à marca ShipClaw em derivações.  
🇬🇧 Source code free for educational reuse and as a base for documentation portals, provided security meta tags are preserved and ShipClaw references are removed in derivations.

---

**Mantenedor / Maintainer:** Brenda Tavares (ShipClaw)  
**Versão / Version:** 2.3  
**Última atualização / Last update:** 2026-07-19

> **Alterações da v2.3 (2026-07-19):**
> - Allowlist OpenRouter atualizada para os **8 modelos free** atualmente disponíveis (M3, M2.7, Nemotron Super 120B, Nemotron Nano 30B Reasoning, Nemotron Ultra 550B, Z.AI GLM 5.2, Cohere North Mini, Poolside Laguna XS 2.1)
> - Removido `gemma-2-9b-it:free` (indisponível)
> - Nova persona **"Arquiteto de Prompts (RACE)"** no Playground e Token Simulator — framework RACE (Role/Action/Context/Expectation) + restrições anti-alucinação
> - Token Simulator agora usa `minimax/minimax-m2.7:free` e o system prompt `PROMPT_ENGINEER_SYSTEM` (RACE completo)
>
> **Alterações da v2.2 (2026-07-19):**
> - Backend migrado de Cloudflare Workers para **Cloudflare Pages Functions**
> - Modelo de IA migrado de Workers AI para **OpenRouter** (4 modelos free iniciais)
> - `worker-playground/` removido da estrutura — substituído por `site/functions/api/chat.js`
> - CSP `connect-src` reduzido para `'self' http://localhost:*` (chave fica server-side)
> - Playground reformulado para **comparação lado a lado** de 2-4 modelos
> - Chave da API gerenciada via **variável de ambiente** do provedor de deploy
