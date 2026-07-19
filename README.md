# Claritas

> Portal técnico de Engenharia de Prompt e Documentação Markdown.
> Projeto portfólio — **Brenda Tavares** (ShipClaw).

---

## Visão Geral

Claritas é um portal de documentação sênior que une **Markdown** (sintaxe universal para documentação técnica) e **Engenharia de Prompt** (comunicação estruturada com modelos de linguagem), com fundamentação em especificações oficiais (CommonMark, GFM) e literatura acadêmica (Wei et al., Phoenix & Corbin, Winters et al.).

Construído sob política **zero-build, zero-dependency** — o HTML abre diretamente no navegador, sem compilação, sem bundlers, sem runtime JavaScript externo.

---

## Stack Tecnológica

| Camada | Tecnologia | Frameworks |
|--------|-----------|------------|
| **Frontend** | HTML5 Semântico + CSS3 Puro + JavaScript Vanilla ES6+ | Zero frameworks JS |
| **Design** | CSS Grid, Flexbox, Variáveis CSS (`:root`), Custom Properties | Zero bibliotecas CSS |
| **Tipografia** | Inter (corpo) + Playfair Display (títulos) via Google Fonts | Única dependência externa |
| **Backend (API)** | Cloudflare Workers + Hono (framework web para Workers) | Hono ^4.6 |
| **Streaming** | Server-Sent Events (SSE) via TransformStream | Nativo do Workers |
| **Deploy** | Wrangler CLI | Zero build local |
| **Segurança** | Content-Security-Policy, X-Frame-Options, Referrer-Policy | Meta tags + HTTP headers |
| **Controle** | Git + GitHub | — |

### Linguagens

- **HTML5** — 100% semântico (header, nav, main, section, footer, details, summary)
- **CSS3** — Grid layouts, Flexbox, animações keyframe, media queries, prefers-reduced-motion
- **JavaScript ES6+** — SPA routing, IntersectionObserver / scroll tracking, SSE streaming, async/await
- **TOML** — Configuração do Worker (`wrangler.toml`)
- **JSON** — Pacotes npm e schemas de API

---

## Funcionalidades

- **Roteador SPA** com Allowlist defensiva — 15 rotas validadas, fallback seguro para `#home`
- **Sidebar flutuante** com tracking de profundidade — item ativo em destaque, demais com escala decrescente
- **Dark Mode** com persistência via `localStorage` — toggle claro/escuro
- **Playground de Prompt** — chat interativo com Gemini 1.5 via Cloudflare Worker (SSE)
- **Contador de Tokens** — estimativa chars/4 com simulação de custo
- **Footer 4 colunas** — navegação completa, links externos para CommonMark, GFM, Markdown Guide
- **Design responsivo** — desktop (1200px), tablet (768px), mobile (480px)
- **Acessibilidade** — prefers-reduced-motion, hierarquia visual, contraste WCAG AA

---

## Estrutura do Projeto

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
│   │   └── index.js            # Cloudflare Worker (proxy Gemini)
│   ├── wrangler.toml           # Configuração do Worker
│   └── package.json            # Dependências (Hono + Wrangler)
│
└── README.md                   # Este arquivo
```

---

## Execução Local

### Frontend (abertura direta)
Abra `site/index.html` no navegador. Nenhuma instalação necessária.

### Servidor estático (para CSP)
```bash
cd site
python -m http.server 8080
# ou: npx serve . --listen 8080
```
Acesse `http://localhost:8080`

### Playground com Gemini
O playground requer o Worker Cloudflare rodando:

```bash
cd worker-playground
echo GEMINI_API_KEY=sua-chave-aqui > .dev.vars
npm run dev
```

Em produção:
```bash
cd worker-playground
echo "GEMINI_API_KEY=sua-chave-aqui" | wrangler secret put GEMINI_API_KEY
npm run deploy
```

O URL do Worker deve ser atualizado no `connect-src` da CSP em `site/index.html` (substituir `https://*.workers.dev` pelo domínio real).

---

## Segurança

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

### Medidas implementadas
- **Zero dependências externas** no frontend (exceto Google Fonts)
- **Zero `innerHTML`** com dados de usuário — toda saída dinâmica usa `textContent` + `appendChild`
- **Zero `eval()`** — CSP sem `'unsafe-eval'`
- **Zero CDN** — sem scripts de terceiros
- **Allowlist de rotas** — rejeição automática de rotas inválidas
- **Links externos** com `target="_blank" rel="noopener noreferrer"`

### Observações para produção
- Restringir CORS do Worker ao domínio do Claritas
- Configurar domínio customizado para o Worker (evitar exposição da API key em URLs)
- Adicionar rate limiting no Worker
- Validar tipos dos campos `model` e `messages` no endpoint `/api/complete`

---

## API (Cloudflare Worker)

### `POST /api/complete`
Proxy SSE para Google Gemini API.

**Request:**
```json
{
  "model": "gemini-1.5-flash",
  "messages": [
    { "role": "system", "content": "Você é um assistente..." },
    { "role": "user", "content": "Explique Markdown" }
  ]
}
```

**Response:** Server-Sent Events stream com tokens incrementalmente.

### `GET /api/health`
Health check. Retorna `{ "status": "ok" }`.

---

## Portfólio

Este projeto demonstra:

- **Arquitetura SPA zero-build** — HTML único que funciona sem servidor
- **Governança por prompt** — toda modificação passa por auditoria de 6 testes de estresse
- **Design system rigoroso** — paleta definida, dark mode, sem frameworks CSS
- **Streaming serverless** — SSE via Cloudflare Workers + Hono
- **Segurança em camada única** — CSP como única barreira, sem backend
- **UX com scroll tracking** — sidebar adaptativa com profundidade visual

---

## Licença

Projeto de código aberto mantido por **Brenda Tavares** (ShipClaw).  
Código-fonte livre para reuso educacional e base para portais de documentação, desde que mantidas as meta tags de segurança e removidas as referências à marca ShipClaw em derivações.

---

**Mantenedor:** Brenda Tavares (ShipClaw)  
**Repositório ShipClaw:** *(a definir)*  
**Versão:** 2.0  
**Última atualização:** 2026-07-14
