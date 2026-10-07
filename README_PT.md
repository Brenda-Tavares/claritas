# Claritas

> Portal técnico de Engenharia de Prompt e documentação Markdown.
> **Português** · [English](README.md) · [中文](README_ZH.md)

**Versão:** 2.20 · **Mantenedora:** Brenda Tavares (ShipClaw) · **Última atualização:** 2026-10-05

Zero-build, sem bibliotecas, com foco em privacidade. Toda decisão sensível roda numa função serverless; o navegador nunca guarda uma credencial.

---

## 1. O problema

Markdown é a sintaxe universal da documentação técnica, e engenharia de prompt é a sintaxe universal de falar com um modelo de linguagem. As duas são ensinadas mal, porque as duas costumam ser apresentadas como truques e não como ofício, com regras, modos de falha e trade-offs.

Existia também um problema de fronteira. Um portal que ensina engenharia de prompt não pode exagerar o que é. Se instruções internas vazam na resposta, se uma regra de segurança é só uma sugestão, ou se um bloco fixo de texto é vestido de recuperação dinâmica, a ferramenta deixa de ser uma ponte e vira uma abstração enganosa.

## 2. Como foi pensado

Três compromissos moldaram cada decisão:

1. **O isolamento tem de ser arquitetural, não comportamental.** Uma interface de "um modelo por aba" depende da disciplina do usuário. Isolamento de verdade significa que o *servidor* é dono da allowlist, que o navegador não consegue escalar e que a credencial nunca sai da função.
2. **Honestidade vence impressão.** Dizer "isto não é RAG" vale mais do que insinuar um pipeline de recuperação que não existe. Limite declarado é feature; limite escondido é defeito.
3. **Documentação que não pode ser verificada apodrece.** Números, ids de modelo e limites são lidos da fonte no momento da checagem, não digitados à mão. Uma afirmação que sai de sincronia com o código deve falhar no build, não no leitor.

## 3. A solução

Um portal estático (`site/index.html` e `site/app.js`, sem etapa de build) que ensina o ofício e permite praticá-lo, apoiado por uma função serverless que é dona da chamada ao provedor.

- Uma **referência de Markdown** fundamentada em CommonMark e GFM, com um renderizador mínimo que cobre o subconjunto que a página realmente usa.
- Um **Playground de Prompt** que roda 2–3 modelos da allowlist lado a lado, mantém uma conversa separada por card e rotula cada modelo com sua vocação.
- Um **fluxo de LLM em dois estágios** (*LLM workflow*) em que nenhum estágio nunca responde ao usuário: o Simulador reescreve um prompt, e o Arquiteto de Prompts escreve o prompt que um terceiro sistema vai executar. Esse segundo estágio é **metaprompting** — o artefato que ele produz é um prompt, não uma resposta, e ele se destina a outra IA. Os dois rótulos descrevem a mecânica documentada abaixo, em vez de uma taxonomia emprestada de outro lugar; onde um termo exageraria o que o código faz, este projeto se recusa a usá-lo.
- Um **Simulador** e um **Contador de Tokens** que respondem no idioma da interface, preferindo o `usage` real do provedor e caindo para uma estimativa `ceil(caracteres / 4)` quando o provedor não devolve nenhum.
- Um **proxy serverless** com allowlist de modelos, rate limit, teto de body e filtro de eco de instrução na saída.

## 4. Stack tecnológica

| Camada | Tecnologia | Observações |
|---|---|---|
| Frontend | HTML5 semântico + CSS3 puro + JavaScript vanilla ES6+ | Sem frameworks JS |
| Design | CSS Grid, Flexbox, custom properties, dark mode | Sem bibliotecas CSS |
| Tipografia | Inter + Playfair Display (Google Fonts) | Única requisição externa |
| Backend | Cloudflare Pages Functions | Sem framework |
| Streaming | Server-Sent Events via `TransformStream` | Nativo do runtime Workers |
| Provedor de IA | OpenRouter através da Pages Function | Camada gratuita, proxy server-side |
| i18n | Dicionário inline PT / EN / 中文, persistido em `localStorage` | Sem biblioteca de i18n |
| Deploy | Cloudflare Pages, conectado ao repositório Git | Sem etapa de build |
| Controle de versão | Git + GitHub | — |

### Contagens verificadas

Estas são lidas da fonte, não transcritas. Uma mudança no código que não seja espelhada aqui é uma checagem reprovada.

| Item | Quantidade |
|---|---|
| Modelos free (allowlist do servidor) | **11** |
| Skills de domínio | **6** |
| System prompts na demo | **6** |
| Chaves de i18n (PT / EN / 中文) | **274** |

### Os onze modelos da allowlist

| Id do modelo | Vocação |
|---|---|
| `cohere/north-mini-code:free` | Código |
| `google/gemma-4-26b-a4b-it:free` | Geral |
| `google/gemma-4-31b-it:free` | Geral |
| `inclusionai/ling-3.0-flash-sante:free` | Saúde |
| `liquid/lfm-2.5-2.6b:free` | Geral |
| `nvidia/nemotron-3.5-content-safety:free` | Segurança |
| `poolside/laguna-s-2.1:free` | Código |
| `poolside/laguna-xs-2.1:free` | Código |
| `openrouter/free` | *(roteador)* |
| `thinkingmachines/inkling:free` | Visual |
| `thinkingmachines/inkling-small:free` | Visual |

`openrouter/free` **não é um modelo** — é o roteador do OpenRouter: escolhe um dos modelos gratuitos disponíveis a cada requisição e não diz qual. Por isso não tem skill, não tem perfil de modelo e não tem entrada em `MODEL_SKILL`: qualquer um dos três descreveria o modelo que ainda não foi escolhido, e o perfil tem precedência sobre a diretiva de skill. O cliente o rotula como roteador no seletor e no card de resultado. O valor do modo é não precisar escolher; o custo é que **a resposta pode não ser adequada** em algumas situações.

**O fallback declara quem respondeu.** Quando o modelo pedido está fora do ar, o servidor tenta até 3 candidatos da allowlist. O cliente recebia a resposta de outro sem perceber: o card prometia um modelo e a resposta era de outro. Agora o servidor envia `X-Claritas-Model` com o id que atendeu, e o card exibe um aviso separado dizendo de qual modelo veio a resposta. O id do header é validado contra a lista local antes de virar texto — é dado vindo da rede, e o aviso usa `textContent`, nunca `innerHTML`.

## 5. Funcionalidades

- **Roteador SPA** com allowlist defensiva de rotas e fallback seguro para `#home`
- **Interface trilíngue** — PT / EN / 中文, dicionário inline de 274 chaves, persistido em `localStorage` sob `claritas-lang`; as páginas Markdown, Engenharia de Prompt e Output Cru estão totalmente traduzidas
- **IA responde no idioma da interface** — o cliente envia `lang`, a função anexa uma diretiva de idioma fixa que ela controla; o cliente não pode sobrescrever
- **Playground de Prompt** — 2–3 modelos do OpenRouter lado a lado via SSE, conversa contínua por card, diretiva por modelo anexada à última mensagem `system`, badge de vocação por modelo, cópia por resposta, tentar novamente por card e um diálogo de configuração acessível
- **Seleção de modelo/persona travada na interface** durante o diálogo ativo. O servidor é stateless e revalida cada requisição por conta própria, então a continuidade é um contrato do cliente, não uma garantia do servidor.
- **Detecção de resposta evasiva ou verbosa** — o card é sinalizado e oferece tentar novamente
- **Filtro de saída (OWASP LLM07)** — a função trunca e mascara respostas que ecoam as mensagens `system` do próprio app
- **Simulador de tokens** — otimização de prompt (remover verbosidade, estrutura básica)
- **Contador de tokens** — chama o provedor para obter `prompt_tokens` e `completion_tokens` reais
- **Sidebar flutuante** com tracking de profundidade, **dark mode**, **layout responsivo** e suporte a movimento reduzido
- **Acessibilidade** — landmarks semânticos, focus trap com `Esc` e fechamento por backdrop no diálogo, contraste WCAG AA

## 6. Arquitetura de IA — o que é e o que não é

**Isto não é RAG.** Não há embeddings, banco vetorial, indexação de documentos nem etapa de recuperação em runtime. Todo comportamento vem de system prompts escritos à mão — um preâmbulo de segurança, personas fixas, regras anti-prompt-injection e um guia de composição de prompt — enviados direto ao modelo via `chat/completions` do OpenRouter. O conhecimento é estático e está escrito dentro dos prompts.

O bloco de conhecimento é texto fixo concatenado no system prompt, e ele é rotulado `não-RAG` no código exatamente para manter a fronteira visível para quem ler o código depois.

### Onde os prompts vivem, e o que eles são

Os prompts vivem em [`functions/api/prompts.js`](site/functions/api/prompts.js) — **no servidor**. O navegador nunca os recebe. Ele envia apenas a *chave* da persona (`"technical"`), a função valida contra uma allowlist, resolve o texto por conta própria e descarta todas as mensagens `system` que o cliente tentou enviar.

> **Os prompts deste repositório são EXEMPLOS.** Foram escritos para explicar a arquitetura e divergem de propósito dos prompts do projeto publicado, que não estão aqui. Para reutilizar o código, substitua os blocos `EXAMPLE_*` pelo seu próprio prompt.

Abra o `prompts.js` e você vai ler o texto do prompt: é isso que código-fonte é em um repositório público, e esconder não é controle. O que a arquitetura realmente compra é que o **cliente não consegue injetar** (`system` é descartado — OWASP LLM01) e o **modelo não consegue ecoar** (filtro anti-eco — OWASP LLM07). Nenhum dos dois é sigilo de código-fonte; isso exige repositório privado.

### Prompts de persona

Seis system prompts no total: quatro selecionáveis no Playground, mais um para cada ferramenta.

| Chave | Papel | Tipo |
|---|---|---|
| `default` | Assistente geral | Diálogo |
| `technical` | Engenheiro sênior | Diálogo |
| `creative` | Designer | Diálogo |
| `prompt-engineer` | Arquiteto de Prompts (RACE) | Artefato estruturado |
| `optimizer` | Simulador | Ferramenta |
| `estimator` | Contador de tokens | Ferramenta |

Personas de diálogo respondem em conversa; o Arquiteto de Prompts produz um artefato em Markdown voltado para outra IA, agente ou ferramenta. Personas de ferramenta são excluídas da diretiva por modelo para que a saída estruturada continue disciplinada.

As **6 skills de domínio** — código, geral, finanças, saúde, visual e segurança — têm cada uma sua diretiva, aplicada quando o modelo não tem uma específica.

### O fluxo: nenhum estágio responde ao usuário

Dois dos seis system prompts são ferramentas, não conversadoras. O que os torna um fluxo em vez de dois recursos soltos é uma regra que ambos obedecem: **nenhum deles executa a tarefa que recebe.**

| Estágio | Persona | Recebe | Devolve | Proibido |
|---|---|---|---|---|
| 1 — Otimizar | `optimizer` | um prompt verboso | a mesma intenção, reestruturada e sem ruído | responder ao pedido que está dentro dele |
| 2 — Arquitetar | `prompt-engineer` | um pedido cru | um artefato em Markdown para outra IA, agente ou ferramenta | responder ao pedido em si |

`EXAMPLE_OPTIMIZER_PROMPT` marca o texto de entrada como dado: tudo o que está entre `<INPUT>` e `</INPUT>` é dado e nunca instrução, e a única saída permitida é o prompt reescrito em Markdown, sem aspas envolventes e sem comentário. `EXAMPLE_PERSONAS['prompt-engineer']` diz a mesma assimetria em uma linha — a única função dele é escrever o prompt, nunca cumprir a tarefa. Ou seja: o estágio que lê texto não confiável está explicitamente proibido de obedecê-lo. Essa é uma barreira de injeção dentro do fluxo (OWASP LLM01), distinta da que descarta uma mensagem `system` enviada pelo cliente.

O artefato existe para ser consumido por uma máquina, e os exemplos o mantêm enxuto em vez de enchê-lo. Onde inventar seria o caminho fácil, o prompt diz para não inventar: `EXAMPLE_PERSONAS['prompt-engineer']` termina com *"Nunca invente contexto que o usuário não forneceu."* Isso é uma instrução ao modelo, não uma garantia sobre o comportamento dele. Um modelo de forma livre pode desobedecer, e é por isso que o cliente verifica o que volta (heurísticas de evasão, truncamento) em vez de confiar só no prompt.

> Estas prompts são exemplos, deliberadamente mais curtos do que as que estão por trás do portal no ar. As regras estruturais acima são o que a arquitetura realmente depende, e valem independente de quanto texto cada prompt dedique a elas.

**Sobre as checagens do cliente.** Dizer a um modelo o que fazer não é o mesmo que conferir o que voltou, então o cliente inspeciona o artefato e avisa quando o contrato parece quebrado. As checagens são estruturais e deliberadamente estreitas; nenhuma delas afirma saber o que o modelo estava pensando.

| Checagem | O que procura | O que o usuário é informado |
|---|---|---|
| Truncamento | a saída bateu no limite no meio do fluxo | o texto está cortado, e repetir não adianta enquanto não mudar — o botão é recolhido, porque uma nova tentativa devolveria o mesmo corte |
| Evasão | nenhuma resposta substantiva | o modelo devolveu quase nada |
| Contrato quebrado | nenhum papel ou tarefa atribuído a outra IA | ver abaixo |

A checagem de contrato quebrado existe por um relato real: pedir ao Arquiteto de Prompts um site para guardar imagens devolveu um documento Markdown bem formatado e confiante que não era prompt nenhum. A checagem antiga só pegava texto corrido, então a pior falha possível — uma resposta que *parece* entregável — passava em silêncio. O aviso que ela agora emite é deliberadamente pouco assertivo: o mesmo modelo, perguntado duas vezes, pode entregar um prompt, pode responder a tarefa diretamente, ou pode pedir os detalhes que ele mesmo diz precisar. Essa variação é a razão do aviso, e a razão de o aviso não nomear uma causa. Repetir é oferecido; trocar de modelo não é, porque a mesma falha acompanha você até outro modelo naquela rodada.

**Sobre o número de economia de tokens.** A porcentagem do Simulador é calculada ao vivo no navegador a partir dos dois textos que você informou — `ceil(caracteres / 4)` cada — não lida de um tokenizador nem medida sobre a saída real de um modelo. Nenhuma redução fixa é afirmada neste projeto: `EXAMPLE_ESTIMATOR_PROMPT` diz na cara dura que é uma estimativa estatística e não o tokenizador real, e devolve a margem de erro junto. Onde o número é real em vez de estimado é o Contador de Tokens, que pergunta ao provedor os `prompt_tokens` e `completion_tokens` de verdade — com a ressalva de que ele degrada em silêncio. Se o provedor não devolver `usage`, `prompt_tokens` cai na mesma estimativa `ceil(text.length / 4)`, `completion_tokens` cai para `0`, e o modo combinado passa a supor que a saída custa exatamente o mesmo que a entrada.

## 7. A API serverless

Um proxy server-side encapsula a chamada ao provedor. A chave de API é variável de ambiente no painel do deploy, nunca está no código do cliente, e o endpoint é consumido só por este site.

**Request**

```json
{
  "model": "cohere/north-mini-code:free",
  "persona": "prompt-engineer",
  "lang": "pt",
  "messages": [
    { "role": "system", "content": "descartado pelo servidor" },
    { "role": "user", "content": "Explique Markdown" }
  ],
  "stream": true
}
```

Uma mensagem `system` enviada pelo cliente é descartada: o servidor injeta o próprio system prompt e nada mais.

**Response** — stream de tokens via SSE (`stream: true`) ou corpo JSON completo (`stream: false`).

### A allowlist de modelos é a fronteira de segurança

O navegador não escolhe modelo livremente. A função valida contra `ALLOWED_MODELS` antes de enviar qualquer coisa para cima. Um modelo fora da lista gera 400, não um fallback.

Quando um modelo falha, a função tenta o modelo pedido mais **no máximo 3 candidatos** no total — o pedido mais até duas reservas da allowlist — para que uma requisição ruim nunca se espalhe em uma rajada de chamadas pagas.

## 8. Segurança

### Content-Security-Policy

`script-src` é `'self'` — sem `'unsafe-inline'` e sem `'unsafe-hashes'`. Isso não é formalidade: um `<script>` inline ou um atributo `onclick` seria a única forma de executar código que a CSP nãoAvaliou, então os dois tiveram que sair. O script do cliente está em `site/app.js` e é carregado com `defer`; os 28 handlers que eram atributos `onclick` viraram atributos `data-*` lidos por um listener delegado único. `'unsafe-hashes'` foi descartado em vez de usado: a diretiva não é uniforme entre navegadores, e onde ela é ignorada as âncoras ficariam silenciosamente sem efeito.

Entregue em duas camadas, porque nem toda diretiva funciona em uma tag `<meta>`. A meta tag do `index.html` cobre as diretivas de carregamento; `frame-ancestors`, `X-Frame-Options: DENY` e `X-Content-Type-Options: nosniff` são entregues como headers HTTP reais via `site/_headers`.

```
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline' https://fonts.googleapis
font-src 'self' https://fonts.gstatic.com
img-src 'self' data:
connect-src 'self' http://localhost:*
base-uri 'self'
form-action 'none'
```

**Via `site/_headers`:** `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.

`style-src` ainda carrega `'unsafe-inline'`: o documento tem 66 atributos `style=""` e um bloco `<style>`. Mover isso para uma folha de estilo é um trabalho à parte, e afirmar o contrário aqui seria exatamente o tipo de alegação que este README evita.

### Limites de recurso

| Constante | Valor | Finalidade |
|---|---|---|
| `RATE_LIMIT_MAX_MIN` | **30** req/min por IP | Limita um único cliente |
| `RATE_LIMIT_MAX_DAY` | **300** req/dia por IP | Impede um consumo lento que o limite por minuto não pega |
| `RATE_LIMIT_AUTO_BLOCK` | **120** em 1 min | Bloqueio de 24h, para comportamento automatizado |
| `MAX_BODY_BYTES` | **256** KB | Um prompt não tem motivo para ser maior |
| `MAX_OUTPUT_TOKENS` | **2.048** | Teto de saída por chamada, limita gasto |
| `MAX_OUTPUT_TOKENS_ARQUITETO` | **6.144** | Mesmo teto para `prompt-engineer`, cujo entregável é um prompt para outra IA — prompt de código com listas e exemplos passa de 2.048 tokens |

Os contadores ficam no Cloudflare KV (`RATE_LIMIT_KV`) quando o binding existe, com fallback em memória para desenvolvimento local.

### Medidas implementadas

- Sem bibliotecas externas no frontend e sem CDN; Google Fonts é a única requisição externa
- Sem `innerHTML` com dados de usuário — a saída dinâmica usa `textContent` e `appendChild`
- Sem `eval()`; a CSP omite `'unsafe-eval'`
- Allowlist de rotas, então uma rota inválida é rejeitada em vez de renderizada
- Links externos carregam `target="_blank" rel="noopener noreferrer"`
- Nenhuma chave de API no código — lida server-side do ambiente do provedor de deploy
- Mensagens `system` enviadas pelo cliente são descartadas no servidor
- Filtro de saída contra eco verbatim das mensagens `system` do app

O mapeamento completo do OWASP LLM Top 10 está em [`SECURITY.md`](SECURITY.md).

## 9. Estrutura do projeto

```
claritas/
├── site/
│   ├── index.html          # Markup, estilos e a meta tag da CSP
│   ├── app.js              # O cliente, em arquivo, para o script-src ficar sem 'unsafe-inline'
│   ├── _headers            # Headers HTTP reais de segurança (Cloudflare Pages)
│   ├── functions/
│   │   └── api/
│   │       ├── chat.js     # Pages Function: proxy OpenRouter, allowlist, rate limit
│   │       └── prompts.js  # Os prompts de sistema reais. Nunca saem do servidor.
│   └── assets/
│       ├── favicon-light.ico
│       ├── favicon-dark.ico
│       ├── icon-light.png
│       ├── icon-dark.png
│       ├── logo-light.png
│       └── logo-dark.png
├── README.md               # Este arquivo
├── README_PT.md            # Versão em português
├── README_ZH.md            # Versão em chinês
├── GUIA_TECNICO.md         # O raciocínio de cada decisão e como o projeto foi construído
├── SECURITY.md             # Modelo de segurança e mapeamento do OWASP LLM Top 10
├── LICENSE                 # Termos (licença própria, não padrão)
├── package.json            # Versão de registro + scripts de checagem e teste
├── scripts/
│   ├── check-readme-parity.mjs   # Números destes READMEs contra o código acima
│   └── test-readme-check.mjs     # Prova que a checagem ainda pega doc corrompido
└── .github/
    └── workflows/
        └── readme-parity.yml     # Roda a checagem em todo push
```

## 10. Como executar

Abra `site/index.html` no navegador. Sem instalação, sem build.

Para exercitar a função localmente:

```bash
npx wrangler pages dev site
```

Para uma pré-visualização estática fiel à CSP:

```bash
npx serve site -l 8080
```

Para conferir os números destes READMEs contra o código:

```bash
npm test          # a checagem, mais a prova de que ela ainda pega divergência
```

O site e a função são publicados pelo **Cloudflare Pages** a partir do repositório Git conectado. A credencial do provedor é variável de ambiente no painel do deploy — nunca um arquivo no repositório.

## 11. Limites honestos

- **Não é benchmark.** Os modelos free são escolhidos por disponibilidade sem custo, não por liderança de desempenho. Uma resposta melhor aqui não é um modelo melhor no seu caso real.
- **Não mede raciocínio.** Sem ground truth e sem scoring; o Playground compara respostas a um dado prompt.
- **Não é oráculo.** Modelos podem errar. Estes controles reduzem injeção, vazamento e alucinação de formato; não eliminam o erro.
- **Google Fonts é a única requisição externa** que a página faz, e a CSP permite exatamente esse host. "Sem bibliotecas" quer dizer sem bibliotecas, não sem requisições de rede.
- **O rate limit em memória é efêmero** — perde-se em cold start, então a produção depende do binding `RATE_LIMIT_KV`.
- **A demo não tem testes end-to-end automatizados.** Os limites da função são assegurados por uma verificação estática sobre o código-fonte, não por um teste de navegador.

## 12. QA/QC

Como este é um artefato público, as verificações fazem parte do que está sendo entregue, e não um hábito privado — qualquer pessoa pode repeti-las e discordar. Toda afirmação estrutural acima é sustentada por uma checagem automática, e não por boas intenções:

| Checagem | O que sustenta |
|---|---|
| `npm run check:readmes` | paridade do dicionário entre os três idiomas, e os limites de recurso batendo com o código |
| `npm run check:claims` | estas páginas não fazem nenhuma afirmação sem fundamento (sem redução fixa, sem garantia contra erro do modelo, sem recurso de raciocínio emprestado) |
| `npm run check:race` | o detector de contrato do Arquiteto de Prompts, ligado ao `app.js` de verdade e não a uma cópia que poderia passar enquanto o app quebrasse |

Cada checagem é provada por mutação: ela é quebrada de propósito para confirmar que falha, porque um teste que nunca se viu falhar é uma suposição. As três rodam na CI a cada push, e a cópia do portfólio é autossuficiente — ela se verifica a partir do próprio diretório, sem o repositório privado.

**O que isto não é.** Nada disso é um benchmark de qualidade de modelo. Não existe gabarito nem pontuação, então passar em todas as checagens significa que o código se comporta como está documentado — não que um modelo respondeu bem.

## 13. Leitura adicional

- [`GUIA_TECNICO.md`](GUIA_TECNICO.md) — o *porquê* de cada decisão e o histórico de desenvolvimento: o que foi tentado, o que foi descartado e por que a forma atual é a que sobreviveu
- [`SECURITY.md`](SECURITY.md) — o modelo de segurança e o mapeamento do OWASP LLM Top 10
- [CommonMark](https://commonmark.org/) · [GFM](https://github.github.com/gfm/) · [OpenRouter](https://openrouter.ai/) · [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)

---

## Licença

Projeto de código disponível mantido por **Brenda Tavares** (ShipClaw).

Contato: [tavaresbrenda@proton.me](mailto:tavaresbrenda@proton.me)

Código-fonte livre para reuso educacional e como base para portais de documentação, desde que as meta tags de segurança sejam preservadas e as referências à marca ShipClaw sejam removidas em derivações. Os termos completos estão em [`LICENSE`](LICENSE) — licença própria (CESL-1.0), não padrão e **não aprovada pela Open Source Initiative**. Vale o texto integral, não o rótulo.
