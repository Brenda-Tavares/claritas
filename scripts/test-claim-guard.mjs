// -----------------------------------------------------------------------------
// Why this test exists
//
// The READMEs are the only place where this project describes what it is, and
// prose does not fail CI. An earlier draft of the docs drifted into four
// specific overstatements: a fixed reduction percentage, a promise of no
// hallucinations, a "zero tolerance" framing, and Chain-of-Thought borrowed as
// a feature. All four were unfounded — the Simulator computes a live estimate,
// the models are free and fallible, and nothing in the pipeline measures or
// requests reasoning.
//
// A guard that bans the *words* would be worse than no guard: this project's own
// honest-limits section says "do not eliminate error" and "format hallucination",
// so a word-level ban would flag the very text that corrects the problem. So the
// patterns below target CLAIMS — the promising phrasing — not vocabulary.
//
// The other direction is checked too, because a guard that only forbids leaves
// the docs free to drift back into vagueness: every README must actually define
// the two labels the project stands behind. A label is kept only while it
// survives "show me the code that does this".
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// A raiz vem da propria localizacao do arquivo. O portfolio precisa funcionar
// sozinho, publicado num diretorio com qualquer nome.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const README_EN = 'README.md';
const README_PT = 'README_PT.md';
const README_ZH = 'README_ZH.md';
const GUIA = 'GUIA_TECNICO.md';
const READMES = [README_EN, README_PT, README_ZH];

// Rotulos que este projeto usa e que precisam continuar definidos por aqui.
const REQUIRED_TERMS = [
    ['LLM workflow', /llm\s+workflow/i],
    ['metaprompting', /metaprompting/i]
];

// Rotulos deliberadamente NAO adotados. Nenhum README pode afirmar qualquer um
// dos dois. No GUIA eles aparecem — e devem aparecer — porque e la que a recusa
// fica explicada; por isso o GUIA fica fora deste teste.
const REJECTED_TERMS = [
    ['meta-framework', /meta[-\s]?framework/i],
    ['chain-to-agent', /chain[-\s]?to[-\s]?agent/i]
];

// Promessas que nao ha como sustentar com o codigo deste repositorio.
// O padrao exige a construcao da promessa ("sem alucinacoes"), e nao a palavra
// solta, para nao acusar a secao quecorrige o problema.
const FORBIDDEN_CLAIMS = [
    {
        what: 'promessa de nao alucinar',
        re: /\b(?:no|zero|never|without|free\s+from|immune\s+to)\s+hallucinat\w*/i
    },
    {
        what: 'promessa de nao alucinar (PT)',
        re: /\b(?:sem|nunca\s+alucina\w*|nunca\s+gera\w*\s+alucina\w*)\b[\s\S]{0,24}alucina\w*/i
    },
    {
        what: 'promessa de nao alucinar (ZH)',
        re: /[\u65e0\u4e0d\u7edd\u4e0d\u4f1a]\u5e7b\u89c9|[\u65e0]幻觉|杜绝幻觉|不会产生幻觉/
    },
    {
        what: 'framing de "tolerancia zero"',
        re: /\bzero[-\s]tolerance\b|toler[aâ]ncia\s+zero|\u96f6\u5bb9\u5fcd/i
    },
    {
        what: 'Chain-of-Thought como recurso',
        re: /chain[-\s]of[-\s]thought|\bCoT\b|\u601d\u7ef4\u94fe/i
    },
    {
        // So e reducao com numero fixo que e problema. "30%", "50%" ou "30-50%"
        // perto de palavra de reducao e promessa de resultado estavel.
        what: 'reducao fixa em porcentagem',
        re: /\b\d{1,3}\s*(?:[-–—]|to|a|até)\s*\d{1,3}\s*%[^.\n]{0,40}(?:less|reduc|sav|econom|poupar|trunc)/i
    },
    {
        what: 'reducao fixa em porcentagem (reduz antes do numero)',
        re: /\b(?:less|sav\w*|economiz\w*|poup\w*|redu[cç]\w*|reduz\w*)\b[^.\n]{0,40}\b\d{1,3}\s*%/i
    },
    {
        what: 'reducao fixa em porcentagem (ZH)',
        re: /\d{1,3}\s*%[^。\n]{0,12}(?:\u51cf\u5c11|\u8282\u7701|\u4fdd\u5b58)|\u51cf\u5c11[^。\n]{0,12}\d{1,3}\s*%/
    }
];

let fail = 0;
let pass = 0;

const check = (ok, label, detail) => {
    if (ok) {
        pass++;
        console.log(`  OK      ${label}`);
    } else {
        fail++;
        console.log(`  FALHA   ${label}`);
        if (detail) console.log(`          ${detail}`);
    }
};

// --- direcao 1: as promessas nao podem voltar ------------------------------
for (const rel of READMES) {
    const text = read(rel);
    for (const claim of FORBIDDEN_CLAIMS) {
        const hit = text.match(claim.re);
        check(
            !hit,
            `${rel}: sem ${claim.what}`,
            hit ? `casou "${hit[0].replace(/\s+/g, ' ').slice(0, 80)}"` : null
        );
    }
    for (const [what, re] of REJECTED_TERMS) {
        const hit = text.match(re);
        check(!hit, `${rel}: nao afirma "${what}"`, hit ? `casou "${hit[0]}"` : null);
    }
}

// --- direcao 2: os rotulos adotados precisam continuar definidos ------------
for (const rel of READMES) {
    const text = read(rel);
    for (const [what, re] of REQUIRED_TERMS) {
        check(re.test(text), `${rel}: define "${what}"`);
    }
}

// --- a recusa precisa continuar documentada ---------------------------------
// Se o GUIA calar sobre os rotulos rejeitados, o projeto deixa de explicar por
// que nao os usa, e o silencio vira license para reaparecerem.
{
    const guia = read(GUIA);
    for (const [what, re] of REJECTED_TERMS) {
        check(re.test(guia), `GUIA_TECNICO.md: registra por que "${what}" foi recusado`);
    }
}

console.log(`\n  ${pass} ok, ${fail} falha(s)`);
if (fail > 0) {
    console.error('\nFALHOU: um README promise algo que o codigo nao sustenta.');
    process.exit(1);
}
console.log('OK');