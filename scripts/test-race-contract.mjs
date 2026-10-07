// -----------------------------------------------------------------------------
// Why this test exists
//
// A user asked the Prompt Architect for a site for storing images and got
// something worse than a bad answer: a well-formatted, confident Markdown
// document that had nothing to do with the deliverable. The existing check,
// isPlainVerbose, only catches prose ("texto corrido"). It is blind to that
// case by construction, because the failing answer HAS Markdown markers.
//
// So the Playground was silent on the worst failure it can produce: an answer
// that looks like a deliverable and is not one.
//
// This test binds the detector to the real source. It does not re-implement the
// heuristic -- a copy in the test file would keep passing after the app broke,
// which is the failure mode this project keeps paying for. It extracts the
// actual RACING_DIRECTIVE / stripQuotedMaterial / isOffRaceContract from
// site/app.js and runs fixtures against them.
//
// It also fails loudly if the extraction stops matching, because a test that
// silently tests nothing is worse than no test.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// O bloco vai de `const RACING_DIRECTIVE` ate o fim de isOffRaceContract,
// que fecha na mesma indentacao do inicio do bloco.
function loadDetector(appPath) {
    const src = read(appPath);
    const start = src.indexOf('const RACING_DIRECTIVE');
    if (start === -1) throw new Error(`${appPath}: RACING_DIRECTIVE nao encontrada`);
    const end = src.indexOf('function isOffRaceContract', start);
    if (end === -1) throw new Error(`${appPath}: isOffRaceContract nao encontrada`);
    const fnEnd = src.indexOf('\n            }', end);
    if (fnEnd === -1) throw new Error(`${appPath}: isOffRaceContract nao fecha`);
    const block = src.slice(start, fnEnd + '\n            }'.length);
    // eslint-disable-next-line no-new-func
    const factory = new Function(`${block}
        return { RACING_DIRECTIVE, isOffRaceContract };`);
    return factory();
}

const APPS = ['site/app.js'];

const CASES = [
    // --- desvio que o aviso antigo NAO via: markdown, e resposta -----------
    {
        name: 'respondeu a tarefa em Markdown (o caso do bug)',
        expect: true,
        text: '## Opções para guardar imagens\n\n**Google Cloud Storage**\n- Armazenamento de objetos\n- SDK para várias linguagens\n\n**Imgur**\n- Upload pelo navegador\n\n**Recomendo** começar pelo Cloud Storage se você pretende crescer.'
    },
    {
        name: 'markdown com plano em vez de prompt',
        expect: true,
        text: '## Site para guardar imagens\n\n1. Escolha um provedor de object storage\n2. Configure upload no backend\n3. Use CDN para as imagens\n\nVocê pode usar S3 ou Cloud Storage para escalar.'
    },
    {
        name: 'pediu mais detalhes (desvio legitimo do contrato)',
        expect: true,
        text: 'Antes de montar o prompt, preciso de duas definições:\n\n1. O público é técnico ou leigo?\n2. O volume estimado de imagens por mês?'
    },
    {
        name: 'texto corrido',
        expect: true,
        text: 'Para criar um site para guardar imagens você pode usar serviços de hospedagem como o Google Cloud Storage ou o Imgur. Existem opções gratuitas e pagas que atendem diferentes necessidades de armazenamento.'
    },
    // --- prompts legitimos: NENHUM pode ser acusado -----------------------
    {
        name: 'prompt completo com papel, tarefa e entregável',
        expect: false,
        text: 'Você é um desenvolvedor back-end especialista em object storage.\n\nSua tarefa: projetar a arquitetura de um site de hospedagem de imagens.\n\nEntregue: um documento Markdown com esquema de dados, endpoints e limites de custo.\n\nNão inclua: saudações, disclaimers ou explicação de por que escolheu o esquema.'
    },
    {
        name: 'restrição negativa cita o texto proibido (falso positivo clássico)',
        expect: false,
        text: 'Atue como especialista em infraestrutura. Monte o plano de armazenamento.\n\nNão escreva "Claro!" ou "Recomendo que você use" na resposta.'
    },
    {
        name: 'composição por rótulos, sem "você é"',
        expect: false,
        text: '## Prompt\n\nPapel: designer de interfaces.\nAção: montar a tela de upload.\nContexto: público leigo, fotos de produto.\nExpectativa: Markdown, no máximo 3 seções.'
    },
    {
        name: 'your task / act as em inglês',
        expect: false,
        text: 'You are a technical writer.\n\nYour task: write the prompt that another AI will run to design an image-hosting site.\n\nDo not include greetings.'
    },
    {
        name: 'vazio (o aviso evasivo trata antes)',
        expect: false,
        text: ''
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

for (const app of APPS) {
    let d;
    try {
        d = loadDetector(app);
    } catch (e) {
        check(false, `${app}: extracao do detector`, e.message);
        continue;
    }
    check(typeof d.isOffRaceContract === 'function', `${app}: isOffRaceContract extraida`);
    check(d.RACING_DIRECTIVE instanceof RegExp, `${app}: RACING_DIRECTIVE e um RegExp`);
    // O aviso so existe se a chave estiver no dicionario: um detector perfeito
    // sem texto para o usuario seria um teste que passa e um produto calado.
    check(
        read(app).includes('"pg.warning_fora_contrato"'),
        `${app}: pg.warning_fora_contrato presente no dicionario`
    );

    for (const c of CASES) {
        const got = d.isOffRaceContract(c.text);
        check(
            got === c.expect,
            `${app}: ${c.name}`,
            `esperado ${c.expect ? 'acusar' : 'nao acusar'}, veio ${got ? 'acusar' : 'nao acusar'}`
        );
    }
}

// A regra que o aviso antigo nao cobrava: o detector precisa accusing MENOS
// o que so nao tem Markdown? Nao — o inverso. Um aviso de contrato acusando
// todo output sem papel deixaria de ser util. Por isso a cobertura mede os dois
// lados e nao aceita um detector que acuse tudo.
console.log(`\n  ${pass} ok, ${fail} falha(s)`);
if (fail > 0) {
    console.error('\nFALHOU: o detector do contrato RACE mudou de comportamento.');
    process.exit(1);
}
console.log('OK');