// -----------------------------------------------------------------------------
// Why this test exists
//
// SECURITY.md carried an OWASP LLM Top 10 table whose LLM01/LLM07 rows
// described an architecture the code did not have: it claimed the prompts were
// "reproducible EXAMPLEs in the client bundle, by design", while the README
// claimed the opposite. Both were wrong, and nothing caught it — a security
// table is prose, and prose does not fail CI.
//
// So each row is bound to code. Deleting a control breaks this test, which
// means the documentation cannot silently drift away from the implementation
// again.
//
// Two directions are checked, because each catches what the other misses:
//   FORWARD  the claim says a control is active  -> assert the code exists
//   BACKWARD the docs mention an identifier      -> assert the code still has it
//            (this is what catches stale docs: SECURITY.md kept naming
//             SECURITY_PREAMBLE and buildSystemPrompt long after both were gone)
// -----------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// A raiz e derivada deste arquivo, como o outro checker do portfolio. A versao
// anterior apontava '../../portfolio/' com URL, o que funciona enquanto a pasta
// se chamar portfolio em algum lugar do disco — e quebra assim que este
// repositorio e publicado sozinho num diretorio que nao seja portfolio.
// Extrair da propria localizacao e o que o torna independente do nome da pasta.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const CHAT = 'site/functions/api/chat.js';
const INDEX = 'site/index.html';
const APP = 'site/app.js';
const PROMPTS = 'site/functions/api/prompts.js';
const HEADERS = 'site/_headers';
const PKG = 'package.json';

let fail = 0;
const ok = (cond, label) => {
    console.log(`  ${cond ? 'ok  ' : 'FALHA'} ${label}`);
    if (!cond) fail++;
};

const section = (t) => console.log(`\n${t}`);

// Remove comentarios antes das checagens que procuram construcoes PROIBIDAS.
//
// A v2.20 trouxe um comentario no app.js explicando que o aviso novo e escrito
// com textContent e nunca com innerHTML — e `LLM05: sem innerHTML` reprovou
// na palavra dentro da propria explicacao. O banimento estava certo; o que se
// lia estava errado. "Zero innerHTML" e propriedade de CODIGO, nao de prosa:
// um comentario que nomeia innerHTML nao cria XSS.
//
// Checagens do tipo "existe" continuam na fonte crua (comentario tambem pode
// documentar um controle que existe), e as de "nao existe" usam a versao sem
// comentario. Sem isso, o guard vira ruido — e ruido e o que se silencia.
//
// Um lexer, nao um regex. A primeira versao deste fix era
// `replace(/"(?:\\.|[^"\\])*"/g, m => espaco)` e ela apagava o CONTEUDO das
// strings, o que derrubou 11 verificacoes de uma vez: onze alarmes, e nao um
// alarme falso. Pior: aplicava um lexer de JS em index.html, comecando a
// comerAttributes do CSP. O caso ambiguo e "//" dentro de string ou de regex
// literal — um stripper ingenuo apaga codigo de verdade em vez de commentario.
//
// Tokens apos os quais "/" inicia regex em vez de divisao.
const REGEX_PRECEDERS = new Set([
    '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*',
    '%', '<', '>', '~', '^', '=>', 'return', 'typeof', 'instanceof', 'in',
    'of', 'new', 'delete', 'void', 'do', 'else', 'case', 'yield', 'await'
]);

/**
 * Remove comentarios de JS, preservando tamanho e quebras de linha para que um
 * report ainda aponte a linha original. Strings e templates ficam intactos:
 * uma construcao proibida so e defeito quando e codigo.
 */
const stripJsComments = (src) => {
    let out = '';
    let i = 0;
    const n = src.length;
    let prevSig = '';

    const lastWord = () => {
        const m = /([A-Za-z_$][\w$]*)\s*$/.exec(out);
        return m ? m[1] : '';
    };
    const isRegexStart = () => {
        if (prevSig === '') return true;
        if (REGEX_PRECEDERS.has(prevSig)) return true;
        if (/[A-Za-z0-9_$]/.test(prevSig)) return REGEX_PRECEDERS.has(lastWord());
        return false;
    };
    const blank = (text) => text.replace(/[^\n]/g, ' ');

    while (i < n) {
        const ch = src[i];
        const next = src[i + 1];

        if (ch === '/' && next === '/') {
            const end = src.indexOf('\n', i);
            const stop = end === -1 ? n : end;
            out += blank(src.slice(i, stop));
            i = stop;
            continue;
        }
        if (ch === '/' && next === '*') {
            const end = src.indexOf('*/', i + 2);
            const stop = end === -1 ? n : end + 2;
            out += blank(src.slice(i, stop));
            i = stop;
            continue;
        }
        if (ch === '`') {
            const start = i;
            i++;
            while (i < n) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === '`') { i++; break; }
                if (src[i] === '$' && src[i + 1] === '{') {
                    i += 2;
                    let depth = 1;
                    while (i < n && depth > 0) {
                        if (src[i] === '{') { depth++; i++; continue; }
                        if (src[i] === '}') { depth--; i++; continue; }
                        if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
                            const q = src[i];
                            i++;
                            while (i < n && src[i] !== q) {
                                if (src[i] === '\\') i++;
                                i++;
                            }
                            i++;
                            continue;
                        }
                        i++;
                    }
                    continue;
                }
                i++;
            }
            out += src.slice(start, i);
            prevSig = '`';
            continue;
        }
        if (ch === '"' || ch === "'") {
            const start = i;
            i++;
            while (i < n) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === ch) { i++; break; }
                if (src[i] === '\n') { i++; break; }
                i++;
            }
            out += src.slice(start, i);
            prevSig = 'x';
            continue;
        }
        if (ch === '/' && isRegexStart()) {
            const start = i;
            i++;
            let inClass = false;
            while (i < n) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === '[') { inClass = true; i++; continue; }
                if (src[i] === ']') { inClass = false; i++; continue; }
                if (src[i] === '/' && !inClass) { i++; break; }
                if (src[i] === '\n') break;
                i++;
            }
            while (i < n && /[a-z]/.test(src[i])) i++;
            out += src.slice(start, i);
            prevSig = 'x';
            continue;
        }

        out += ch;
        if (!/\s/.test(ch)) prevSig = ch;
        i++;
    }
    return out;
};

// HTML nao e JS: um lexer aqui comeria os atributos do CSP. O comentario de
// HTML e <!-- -->, e um <script> inline esta proibido pela checagem de CSP
// acima, entao nao ha codigo executavel hiding dentro do arquivo.
const stripHtmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

const chatRaw = read(CHAT);
const indexRaw = read(INDEX);
// O bundle do cliente e o HTML mais o app.js. Quando o script inline virou
// app.js, conferir so o index.html deixou de cobrir metade do que o navegador
// baixa: um prompt de persona, um innerHTML ou uma chave de API entrariam no
// app.js e passariam por todas as verificacoes abaixo. Aqui a leitura e
// client = index + app, porque a pergunta e sempre "o que o navegador recebe".
const clientRaw = indexRaw + '\n' + read(APP);

const chat = stripJsComments(chatRaw);
const index = stripHtmlComments(indexRaw);
const client = stripHtmlComments(indexRaw) + '\n' + stripJsComments(read(APP));
const prompts = stripJsComments(read(PROMPTS));
const headers = read(HEADERS);
const pkg = JSON.parse(read(PKG));

console.log('# integridade das alegacoes OWASP (SECURITY.md <-> codigo)');

// ------------------------------------------------- SELF-TEST DO STRIPPER ------
// Um stripper errado e o jeito mais facil de deixar um guard verde sobre codigo
// quebrado — e esta copia e a que viaja sozinha, sem o repo privado para
// conferir. Estes casos sao a prova de que ele separa codigo de comentario.
section('O removedor de comentarios e confiavel');
ok(!stripJsComments('// innerHTML\n').includes('innerHTML'), 'stripper: "// innerHTML" em comentario some');
ok(!stripJsComments('/* innerHTML */').includes('innerHTML'), 'stripper: bloco de comentario some');
ok(stripJsComments('el.innerHTML = x;').includes('innerHTML'),
    'stripper: innerHTML em codigo real SOBREVIVE (senao o guard nao protege)');
ok(stripJsComments('const u = "http://x";').includes('http://x'),
    'stripper: "//" dentro de string NAO abre comentario');
ok(stripJsComments('const s = `a//b`;').includes('a//b'),
    'stripper: "//" dentro de template literal nao abre comentario');
ok(stripJsComments('const a = 1 / 2;').includes('1 / 2'),
    'stripper: divisao real nao e confundida com regex');
ok(stripHtmlComments('<p>a</p><!-- innerHTML --><p>b</p>').includes('<p>a</p>'),
    'stripper: comentario de HTML some sem comer o resto');
ok(stripHtmlComments('<meta http-equiv="Content-Security-Policy">').includes('http-equiv'),
    'stripper: atributo do CSP sobrevive ao stripper de HTML');

// ---------------------------------------------------------------- FORWARD ----
section('Controles declarados ativos existem no codigo');

// LLM01 — Prompt Injection
ok(/const ALLOWED_PERSONAS = \[/.test(chat), 'LLM01: allowlist ALLOWED_PERSONAS no servidor');
ok(/function isValidPersona\(/.test(chat), 'LLM01: validador de persona');
ok(/jsonError\(400, 'Persona n[ãa]o permitida\./.test(chat), 'LLM01: persona fora da allowlist e rejeitada com 400');
ok(/\.filter\(m => m\.role !== 'system'\)/.test(chat), 'LLM01: mensagens system do cliente sao descartadas');
ok(!/role:\s*'system'/.test(client), 'LLM01: cliente nao envia nenhuma mensagem system');
ok(!/buildSystemPrompt/.test(client), 'LLM01: cliente nao monta mais o system prompt');
ok(/persona: 'optimizer'/.test(client) && /persona: 'estimator'/.test(client), 'LLM01: ferramentas enviam a chave, nao o prompt');
// O portfolio usa <INPUT> como delimitador, nao a tag de producao. A tag real
// nao pode ser escrita aqui: scripts/test-no-prompt-leak.mjs (no repo privado,
// onde os dois lados da comparacao existem) trata qualquer frase de prompt
// privado que apareca no portfolio como vazamento, e o nome da tag de
// producao conta como uma. A diferenca e checada por codigo montado, nao
// por um literal proibido.
const prodTag = ['CLARITAS', 'INPUT'].join('_');
ok(/<INPUT>/.test(client) && !client.includes(prodTag), 'LLM01: delimitadores <INPUT> no simulador/estimador');

// LLM02 — Sensitive Information Disclosure
ok(/env\.OPENROUTER_API_KEY/.test(chat), 'LLM02: chave lida de variavel de ambiente');
ok(!/[sS]k-[oO][rR]|[aA][pP][iI][kK][-_]?[kK][eE][yY]\s*[:=]\s*['"][A-Za-z0-9]/.test(chat + client), 'LLM02: nenhuma chave embutida no codigo');
ok(/Referrer-Policy:\s*no-referrer/.test(headers), 'LLM02: Referrer-Policy no-referrer nos headers');

// LLM03 — Supply Chain
ok(!pkg.dependencies && !pkg.devDependencies, 'LLM03: zero dependencias npm');
ok(/const ALLOWED_MODELS = \[/.test(chat), 'LLM03: allowlist de modelos OpenRouter');

// LLM04 — Data and Model Poisoning
ok(/import \{[\s\S]*?\} from '\.\/prompts\.js'/.test(chat), 'LLM04: conhecimento resolvido server-side');
ok(!/fetch\(['"]https?:/.test(prompts), 'LLM04: prompts.js nao ingere dado externo');

// LLM05 — Improper Output Handling
// O alvo e o codigo, nao a prosa: e por isso que isto roda sobre a fonte sem
// comentarios. Ver a nota do stripper acima.
ok(!/\.innerHTML|document\.write|\beval\(/.test(client), 'LLM05: sem innerHTML/document.write/eval');
ok(/textContent/.test(client), 'LLM05: saida renderizada via textContent');

// O header que declara o modelo veio da rede e vira texto na tela. A checagem
// que impede isso e a mesma que impede XSS: so um id da lista local vira texto.
ok(/OPENROUTER_MODELS\.some\(/.test(client),
    'LLM05: id de X-Claritas-Model validado contra a lista local antes de virar texto');

// LLM06 — Excessive Agency
ok(!/\btools\s*:|function_call|tool_choice/.test(chat), 'LLM06: sem tools/function calling na chamada ao provedor');

// LLM07 — System Prompt Leakage
ok(/function resolvePersona\(/.test(prompts), 'LLM07: prompt resolvido no servidor');
ok(/buildFingerprintMatcher/.test(chat), 'LLM07: filtro anti-eco aplicado na resposta');
ok(/function sanitizeSSE/.test(chat) && /function sanitizeJSON/.test(chat), 'LLM07: filtro cobre stream e nao-stream');
ok(/MASK_TEXT/.test(chat) && /MASK_LINE/.test(chat), 'LLM07: mascaramento efetivamente aplicado');
ok(!/role:\s*'system'/.test(client), 'LLM07: nenhum prompt de persona no bundle do cliente');

// LLM09 — Misinformation
ok(/\[EXEMPLO/.test(prompts), 'LLM09: prompts marcados como exemplo');
ok(/n[ãa]o sabe|admita estimativas|n[ãa]o invente/i.test(prompts), 'LLM09: regra de veracidade no prompt');

// LLM10 — Unbounded Consumption
ok(/const RATE_LIMIT_MAX_MIN = 30/.test(chat), 'LLM10: rate limit 30 req/min');
ok(/const RATE_LIMIT_MAX_DAY = 300/.test(chat), 'LLM10: rate limit 300 req/dia');
ok(/const RATE_LIMIT_AUTO_BLOCK = 120/.test(chat), 'LLM10: bloqueio automatico');
ok(/const MAX_OUTPUT_TOKENS = 2048/.test(chat), 'LLM10: teto de saida por chamada');
ok(/const MAX_BODY_BYTES = 256 \* 1024/.test(chat), 'LLM10: limite de tamanho do body');
ok(/messages\.length > 50/.test(chat), 'LLM10: maximo de mensagens');
ok(/m\.content\.length > 20000/.test(chat), 'LLM10: maximo de caracteres por mensagem');

// ------------------------------------------------------------ HARDENING ----
section('CSP sem script inline');

// A CSP vivia escrita em dois lugares -- a meta no index.html e o cabecalho no
// _headers -- e as duas carregavam 'unsafe-inline' em script-src, que e o que
// deixaria um payload injetado executar sem passar por revisao nenhuma. As duas
// copias nao se conferem sozinhas, entao este bloco compara as duas.
//
// Aqui so a propria arvore do portfolio pode ser conferida, porque este repositorio
// nao enxerga o outro. O mesmo par de verificacoes roda sobre as duas arvores
// no repositorio privado, onde a arvore publica tambem e visivel.
const cspMeta = (index.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/) || [])[1];
const cspHead = (headers.match(/Content-Security-Policy:\s*(.+)/) || [])[1];
const csp = Object.fromEntries(
    (cspMeta || '')
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .map(d => {
            const sp = d.indexOf(' ');
            return [d.slice(0, sp), d.slice(sp + 1).trim()];
        })
);

ok(!!cspMeta, 'CSP: meta http-equiv presente no index.html');
ok(!!cspHead, 'CSP: cabecalho presente no _headers');
ok(!(csp['script-src'] || '').includes('\u0027unsafe-inline\u0027'), "CSP: script-src sem 'unsafe-inline'");
ok(!(csp['script-src'] || '').includes('\u0027unsafe-hashes\u0027'), "CSP: script-src sem 'unsafe-hashes'");
ok(!!(csp['script-src'] || '').includes('\u0027self\u0027'), "CSP: script-src com 'self'");
// frame-ancestors e ignorado pelo navegador quando a CSP chega por <meta>, entao
// ele so vale no _headers, e a meta NAO o declara: as duas assertions abaixo
// cobrem os dois lados disso. A comparacao ignora a diretiva em vez de exigir
// igualdade literal, que nunca vai existir.
const withoutFrameAncestors = (c) => c.split(';').map(s => s.trim()).filter(Boolean).filter(d => !d.startsWith('frame-ancestors')).sort().join(';');
ok(cspMeta && cspHead && withoutFrameAncestors(cspMeta) === withoutFrameAncestors(cspHead), 'CSP: meta e _headers declaram a mesma politica');
ok(!!csp['frame-ancestors'] === false, 'CSP: meta nao declara frame-ancestors -- o navegador ignora la');
ok(/\bframe-ancestors\b/.test(cspHead || ''), 'CSP: frame-ancestors fica no _headers, onde vale');

ok(!/\son[a-z]+\s*=\s*["']/.test(index), 'CSP: nenhum atributo on* no index.html');
ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(index), 'CSP: nenhum <script> sem src no index.html');
ok(/<script src="app\.js" defer><\/script>/.test(index), 'CSP: o cliente carrega app.js com defer');

// -------------------------------------------------------------- BACKWARD ----
section('Identificadores citados na documentacao ainda existem no codigo');

// Security-relevant identifiers the docs are allowed to name. If the code drops
// one, the docs are stale and must be updated in the same change.
const DOC_IDENTIFIERS = [
    'ALLOWED_PERSONAS', 'ALLOWED_MODELS', 'resolvePersona', 'buildFingerprintMatcher',
    'MAX_OUTPUT_TOKENS', 'MAX_BODY_BYTES', 'RATE_LIMIT_MAX_MIN', 'RATE_LIMIT_MAX_DAY',
    'isValidPersona', 'sanitizeSSE', 'sanitizeJSON'
];

// Identifiers the OLD docs used. These must NOT appear anywhere in the
// portfolio docs: they name an architecture that no longer exists, and one of
// them leaked a private prompt tag.
//
// Nenhum literal aqui pode ser o nome da tag delimitadora de producao: o
// teste de leak trata qualquer frase dos prompts privados que apareca no
// portfolio como vazamento, e a tag conta como uma. `tagPrivada` abaixo e a
// forma de checar a versao antiga sem escrever a tag. Todos os outros nomes
// sao identificadores JS de prompts.js — nao prosa de prompt.
const tagPrivada = ['CLARITAS', 'INPUT'].join('_');
const RETIRED_IDENTIFIERS = [
    'SECURITY_PREAMBLE', 'KNOWLEDGE_BASE', 'SYSTEM_PROMPTS',
    'PROMPT_ENGINEER_SYSTEM', 'TOKEN_ESTIMATOR_SYSTEM',
    'buildSystemPrompt'
];
// Verificado a parte, nao por substring: assim o item proibido nao precisa
// ser escrito para ser procurado.
const PRIVATE_TAG_PHRASES = [tagPrivada];

const codeAll = chat + prompts + client;

const DOC_EXT = new Set(['.md']);
const docFiles = [];
const walk = (dir) => {
    for (const e of readdirSync(dir)) {
        if (e === '.git' || e === 'node_modules') continue;
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (DOC_EXT.has(full.slice(full.lastIndexOf('.')))) docFiles.push(full);
    }
};
walk(ROOT);

let retiredHits = 0;
for (const f of docFiles) {
    const rel = relative(ROOT, f).split(sep).join('/');
    const text = readFileSync(f, 'utf8');
    for (const dead of RETIRED_IDENTIFIERS) {
        if (text.includes(dead)) {
            console.log(`  VAZOU ${rel}: ainda cita "${dead}", que nao existe mais no codigo`);
            retiredHits++;
        }
    }
    for (const tag of PRIVATE_TAG_PHRASES) {
        if (text.includes(tag)) {
            console.log(`  VAZOU ${rel}: cita a tag delimitadora de producao, que e dos prompts privados`);
            retiredHits++;
        }
    }
}
ok(retiredHits === 0, 'docs nao citam identificadores aposentados nem a tag privada');

// Every live identifier the docs name must still exist in code, so a claim
// cannot outlive the control it describes.
let staleHits = 0;
for (const f of docFiles) {
    const rel = relative(ROOT, f).split(sep).join('/');
    const text = readFileSync(f, 'utf8');
    for (const id of DOC_IDENTIFIERS) {
        if (text.includes(id) && !codeAll.includes(id)) {
            console.log(`  VAZOU ${rel}: cita "${id}", ausente do codigo`);
            staleHits++;
        }
    }
}
ok(staleHits === 0, 'todo identificador citado nos docs existe no codigo');

// ------------------------------------------------------------- CONSISTENCY --
section('A tabela OWASP cobre os 10 criterios com status honesto');

const sec = read('SECURITY.md');
const criteria = ['LLM01', 'LLM02', 'LLM03', 'LLM04', 'LLM05', 'LLM06', 'LLM07', 'LLM08', 'LLM09', 'LLM10'];
for (const c of criteria) {
    ok(new RegExp(`\\|\\s*${c}\\b`).test(sec), `${c} presente na tabela de SECURITY.md`);
}

// A row cannot claim "Ativo" while its control is missing. LLM07 must not be
// downgraded to "Demo" anymore, because the client-side prompt is really gone.
ok(/\|\s*LLM07[^\n]*Ativo/.test(sec), 'LLM07 consta como Ativo (nao mais "Demo")');
ok(/Limite honesto/.test(sec), 'LLM07 declara o limite (repo publico nao e sigilo de source)');
ok(/EXEMPLO/.test(sec), 'a nota de arquitetura declara que os prompts sao exemplos divergentes');

console.log(fail ? `\n${fail} falha(s)` : '\nalegacoes OWASP conferem com o codigo');
process.exit(fail ? 1 : 0);
