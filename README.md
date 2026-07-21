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
| **Backend (API)** | Cloudflare Workers + Hono | Hono ^4.6 |
| **Streaming** | Server-Sent Events (SSE) via TransformStream | Native to Workers |
| **Modelo de IA / AI Model** | Workers AI (Llama 3.1 8B / Llama 3.2 3B) | Gratuito / Free tier |
| **Deploy** | Cloudflare Pages (site) + Wrangler (Worker) | Zero build local / Local zero build |
| **Segurança / Security** | Content-Security-Policy, X-Frame-Options, Referrer-Policy | Meta tags + HTTP headers |
| **Controle / Version Control** | Git + GitHub | — |

### Linguagens / Languages

- **HTML5** — 100% semântico / semantic (header, nav, main, section, footer, details, summary)
- **CSS3** — Grid layouts, Flexbox, animações keyframe, media queries, prefers-reduced-motion
- **JavaScript ES6+** — SPA routing, IntersectionObserver / scroll tracking, SSE streaming, async/await
- **TOML** — Configuração do Worker / Worker config (`wrangler.toml`)
- **JSON** — Pacotes npm e schemas de API / npm packages and API schemas

---

## Funcionalidades / Features

- **Roteador SPA** com Allowlist defensiva — 15 rotas validadas, fallback seguro para `#home`
- **Sidebar flutuante** com tracking de profundidade — item ativo em destaque, escala decrescente nos demais
- **Dark Mode** com persistência via `localStorage` — toggle claro/escuro
- **Playground de Prompt** — chat interativo com Workers AI via Cloudflare Worker (SSE)
- **Token Simulator** — otimização automática de prompts via IA
- **Contador de Tokens** — estimativa chars/4 com simulação de custo por modelo
- **Footer 4 colunas** — navegação completa, links externos para CommonMark, GFM, Markdown Guide
- **Design responsivo** — desktop (1200px), tablet (768px), mobile (480px)
- **Acessibilidade** — prefers-reduced-motion, hierarquia visual, contraste WCAG AA

---

## Estrutura do Projeto / Project Structure

```
claritas/
├── site/
│   ├── index.html              # Portal completo (arquivo único)
│   └── assets/
│       ├── favicon-light.ico
│       ├── favicon-dark.ico
│       ├── icon-light.png
│       └── icon-dark.png
│
├── worker-playground/
│   ├── src/
│   │   └── index.js            # Cloudflare Worker (proxy Workers AI)
│   ├── wrangler.toml           # Configuração do Worker
│   └── package.json            # Dependências (Hono + Wrangler)
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

### 🇧🇷 Playground com Workers AI
```bash
cd worker-playground
npm install
npx wrangler dev
```

### 🇬🇧 Playground with Workers AI
```bash
cd worker-playground
npm install
npx wrangler dev
```

### 🇧🇷 Deploy do Worker
```bash
cd worker-playground
npx wrangler deploy
```

### 🇬🇧 Worker Deploy
```bash
cd worker-playground
npx wrangler deploy
```

---

## API (Cloudflare Worker)

### `POST /api/complete`
🇧🇷 Proxy SSE para Workers AI (Llama 3.1 8B / Llama 3.2 3B).
🇬🇧 SSE proxy to Workers AI (Llama 3.1 8B / Llama 3.2 3B).

**Request:**
```json
{
  "model": "llama-3.1-8b",
  "messages": [
    { "role": "system", "content": "Você é um assistente..." },
    { "role": "user", "content": "Explique Markdown" }
  ]
}
```

**Response:** 🇧🇷 Stream de tokens via SSE. / 🇬🇧 Token stream via SSE.

### `GET /api/health`
🇧🇷 Health check. / 🇬🇧 Health check.
Retorna / Returns `{ "status": "ok" }`.

---

## Segurança / Security

### Content-Security-Policy
```
default-src 'self'
script-src 'self' 'unsafe-inline'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
img-src 'self' data:
connect-src 'self' http://localhost:* https://*.workers.dev
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
- **Nenhuma chave de API no código** — secrets gerenciados via `wrangler secret`

---

## Portfólio / Portfolio

Este projeto demonstra / This project demonstrates:

- **Arquitetura SPA zero-build** — HTML único que funciona sem servidor
- **Governança por prompt** — toda modificação passa por auditoria de 6 testes de estresse
- **Design system rigoroso** — paleta definida, dark mode, sem frameworks CSS
- **Streaming serverless** — SSE via Cloudflare Workers + Hono
- **Segurança em camada única** — CSP como única barreira, sem backend
- **UX com scroll tracking** — sidebar adaptativa com profundidade visual

---

## Licença / License

🇧🇷 Projeto de código aberto mantido por **Brenda Tavares** (ShipClaw).  
🇬🇧 Open source project maintained by **Brenda Tavares** (ShipClaw).

🇧🇷 Código-fonte livre para reuso educacional e base para portais de documentação, desde que mantidas as meta tags de segurança e removidas as referências à marca ShipClaw em derivações.  
🇬🇧 Source code free for educational reuse and as a base for documentation portals, provided security meta tags are preserved and ShipClaw references are removed in derivations.

---

**Mantenedor / Maintainer:** Brenda Tavares (ShipClaw)  
**Versão / Version:** 2.1  
**Última atualização / Last update:** 2026-07-19
