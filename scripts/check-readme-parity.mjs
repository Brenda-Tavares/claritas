#!/usr/bin/env node
// Claritas Portfolio — validador de paridade dos READMEs multilíngues.
//
// Esta é a cópia que viaja com o portfólio. O portfolio é publicado como
// repositório autônomo, então ele não pode ler nada de fora desta pasta: todo
// número afirmado nos READMEs é conferido contra o código daqui
// (site/functions/api/chat.js, site/index.html, package.json) e contra nada
// mais. A raiz tem o mesmo check, com um grupo a mais, e um teste exige que as
// duas cópias concordem sobre estes documentos — é isso que impede a duplicação
// de divergir em silêncio.
//
// Checks por documento:
//   1. contagens derivadas do código (ALLOWED_MODELS, i18n, prompts, skills)
//   2. limites de runtime (rate limit, body, tokens)
//   3. ids de modelo listados == ids da allowlist
//   4. skills citadas existem em SKILL_DIRECTIVES_DEMO
//   5. personas do seletor citadas
//   6. versão declarada == package.json
//   7. links relativos resolvem no disco
//   8. encoding: nada de CJK/cirílico corrompido em PT/EN
//
// Checks entre idiomas:
//   9. paridade de seções e das contagens entre EN / PT / ZH
//
// Checks de autossuficiência (todos os .md da pasta, não só os READMEs):
//  10. nenhuma menção a governance/, nenhum caminho que suba, nenhum link para
//      o repositório de origem — o que inclui promessas em prosa como "o CI do
//      repositório de origem garante isto"
//
// Uso:
//   node scripts/check-readme-parity.mjs           # erros + avisos
//   node scripts/check-readme-parity.mjs --strict  # avisos também falham
//
// Sai com código 1 se houver erro (ou aviso, com --strict).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const infos = [];

function report(sev, doc, check, msg) {
  console.log(`  ${sev.padEnd(7)} [${doc}] ${check}: ${msg}`);
  if (sev === 'erro') errors.push({ doc, check, msg });
  else if (sev === 'aviso') warnings.push({ doc, check, msg });
  else infos.push(msg);
}

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

// A versão canônica é a inglesa. PT e ZH são traduções que precisam concordar
// com ela E com o código. Não existe portfolio/package.json por acaso: ele é a
// fonte da versão, e é o que permite a esta pasta ser publicada sozinha.
const DOCS = [
  { id: 'en', file: 'README.md', label: 'English' },
  { id: 'pt', file: 'README_PT.md', label: 'Portugues' },
  { id: 'zh', file: 'README_ZH.md', label: 'Chinese' }
];

// --- verdade extraída do código (desta pasta, e só dela) ----------------
const chat = read('site/functions/api/chat.js');
const idx = read('site/index.html') + read('site/app.js');
const pkg = JSON.parse(read('package.json'));

// ALLOWED_MODELS: bloco entre '[' e ']'
// O id do roteador NAO termina em ':free' (e nao termina assim de proposito:
// e um roteador, nao um modelo gratuito). Casar so com ':free' o deixaria
// fora da contagem e o proprio checker passaria a documentar 10 enquanto o
// codigo tem 11. Por isso o segundo ramo.
const allowBlock = chat.split('const ALLOWED_MODELS = [')[1].split('];')[0];
const allow = [...allowBlock.matchAll(/'([^']+:free|openrouter\/free)'/g)].map(m => m[1]);

// SKILL_DIRECTIVES: foi movido para prompts.js quando os prompts saíram do
// chat.js para o servidor. Ler daqui daria undefined e derrubaria o checker
// inteiro — que foi exatamente o que aconteceu na primeira execução.
const prompts = read('site/functions/api/prompts.js');
const skillBlock = prompts.split('const SKILL_DIRECTIVES = {')[1].split('};')[0];
const skills = [...skillBlock.matchAll(/^\s*([a-z_]+):/gm)].map(m => m[1]);

// Personas do seletor do Playground: vem do <select id="pg-system"> do index.html.
const pgSelect = idx.split('id="pg-system"')[1]?.split('</select>')[0] || '';
const personas = [...pgSelect.matchAll(/value="([a-z-]+)"/g)].map(m => m[1]);

// A lista autoritativa de personas é ALLOWED_PERSONAS, no servidor: é o que o
// endpoint aceita, e portanto o número que os READMEs devem afirmar. Contar
// pelo seletor do HTML errava por omissão — as duas personas de ferramenta
// (optimizer, estimator) não são opcoes do seletor.
const personaBlock = chat.split('const ALLOWED_PERSONAS = [')[1]?.split(']')[0] || '';
const allowedPersonas = [...personaBlock.matchAll(/'([a-z-]+)'/g)].map(m => m[1]);

const TRUTH = {
  allow: allow.length,
  skills: skills.length,
  prompts: allowedPersonas.length,
  i18n: 0 // preenchido abaixo
};

// i18n: dicionário inline. Contamos as entradas com os três idiomas presentes.
// Tolerante a CRLF (o arquivo usa \r\n, então ^ multilinha ancorado falha).
function i18nCount(src) {
  return (src.match(/"([a-zA-Z0-9_.\-]+)":\s*\{\s*pt:/g) || []).length;
}
const i18nPt = i18nCount(idx);
const i18nEn = (idx.match(/en:\s*['"`]/g) || []).length;
const i18nZh = (idx.match(/zh:\s*['"`]/g) || []).length;
TRUTH.i18n = i18nPt;

// limites de runtime
const num = (src, re) => {
  const m = src.match(re);
  return m ? Number(m[1].replace(/_/g, '')) : null;
};
const limits = {
  maxMin: num(chat, /RATE_LIMIT_MAX_MIN\s*=\s*(\d+)/),
  maxDay: num(chat, /RATE_LIMIT_MAX_DAY\s*=\s*(\d+)/),
  autoBlock: num(chat, /RATE_LIMIT_AUTO_BLOCK\s*=\s*(\d+)/),
  maxOut: num(chat, /MAX_OUTPUT_TOKENS\s*=\s*(\d+)/),
  maxOutArq: num(chat, /MAX_OUTPUT_TOKENS_ARQUITETO\s*=\s*(\d+)/),
  bodyKB: num(chat, /MAX_BODY_BYTES\s*=\s*(\d+)\s*\*\s*1024/),
  fallbackTry: (chat.match(/candidates = \[[^\]]*\]\.slice\(0,\s*(\d+)\)/) || [])[1] || null
};

console.log('# verdade do codigo-fonte');
console.log(`  ALLOWED_MODELS      ${allow.length}`);
console.log(`  SKILL_DIRECTIVES    ${skills.length}  (${skills.join(', ')})`);
console.log(`  ALLOWED_PERSONAS    ${allowedPersonas.length}  (${allowedPersonas.join(', ')})`);
console.log(`  personas do seletor ${personas.length}  (${personas.join(', ')})`);
console.log(`  i18n (chaves)       ${i18nPt}  (pt ${i18nPt}, en ${i18nEn}, zh ${i18nZh})`);
console.log(`  limites             ${JSON.stringify(limits)}`);
console.log(`  package.json        ${pkg.version}`);

// Se o seletor offering uma persona que o servidor rejeita, o Playground aceita
// uma escolha e leva a um 400. E se o servidor aceitar uma persona que o
// seletor nao oferece, o documento conta um prompt a mais do que o usuario ve.
for (const per of personas) {
  if (!allowedPersonas.includes(per)) {
    report('erro', 'codigo', 'personas',
      `seletor do Playground oferece "${per}", que NAO esta em ALLOWED_PERSONAS`);
  }
}
if (allowedPersonas.length !== personas.length + 2) {
  report('erro', 'codigo', 'personas',
    `ALLOWED_PERSONAS tem ${allowedPersonas.length} chaves e o seletor oferece ${personas.length}: esperado +2 (personas de ferramenta)`);
}

if (!(i18nPt === i18nEn && i18nPt === i18nZh)) {
  report('erro', 'codigo', 'i18n',
    `dicionário desbalanceado: pt ${i18nPt}, en ${i18nEn}, zh ${i18nZh} (devem ser iguais)`);
}
console.log('');

// --- checks por documento -----------------------------------------------
console.log('# checks por documento');

// padrões que aceitam múltiplas grafias por idioma
const P = {
  i18nCount: [
    /\b263\s+(?:chaves|keys|个(?:翻译)?键|个键)/i,
    /\b263\b/
  ],
  personas: [
    /\*\*6\s+(?:personas|system\s+prompts?)\*\*/i,
    /\b(?:6|six|seis)\s+system\s+prompts?\b/i,
    /6\s*个\s*system\s*prompt/i,
    /六个\s*system\s*prompt/i,
    /6\s+个\s*角色/
  ],
  skills: [
    /\*\*6\s+skills?\*\*/i,
    /skills?\s*\(6\)/i,
    /6\s+domain\s+skills?/i,
    /\b(?:6|six)\s+(?:domain\s+)?skills?\b/i,
    /6个领域技能/,
    /6\s*项领域技能/
  ],
  fallback: [
    /(?:at most|no máximo|mais no máximo|至多|最多)\s*\**3\b/i,
    /\b3\s+(?:tentativas|attempts|candidates|次尝试|次候補)/i,
    /至多\s*\*\*3\s*个候选/,
    /至多 3 个候选/
  ]
};

function matchesAny(text, pats) { return pats.some(p => p.test(text)); }

for (const doc of DOCS) {
  if (!existsSync(path.join(ROOT, doc.file))) {
    report('erro', doc.id, 'existencia', `${doc.file} nao existe`);
    continue;
  }
  const t = read(doc.file);

  // 1. contagens — o número tem que estar NA MESMA LINHA do rótulo, dentro de
  // uma tabela markdown. Fora de tabela não olhamos: busca solta casaria
  // "## 11." e "2026-07" como contagens. Rótulos com underscore (RATE_LIMIT_*)
  // casam via variante que troca "_" por espaço antes do teste.
  //
  // Retorna o número, null se o rótulo não existe em nenhuma tabela, ou NaN se o
  // rótulo existe mas nenhuma célula traz o valor.
  //
  // Detalhe que importa: na própria célula do rótulo, o número pode estar antes
  // ("**30** req/min") ou depois do rótulo. Um número colado a uma letra NÃO é
  // contagem: é parte de um identificador, tipo o "18" de "i18n". Sem essa
  // guarda, "i18n keys" devolveria 18 em vez do 263 que vem na célula seguinte.
  const lines = t.split(/\r?\n/);
  const NUM = String.raw`\d{1,3}(?:[.,]\d{3})*`;
  const firstCount = (str) => {
    if (!str) return null;
    for (const m of str.matchAll(new RegExp(NUM, 'g'))) {
      const next = str[m.index + m[0].length];
      if (next && /[A-Za-z]/.test(next)) continue; // dígito colado a letra
      return Number(m[0].replace(/[.,]/g, ''));
    }
    return null;
  };
  const valueFor = (labelRes) => {
    const rx = [].concat(labelRes);
    const variants = (c) => [c, c.replace(/_/g, ' ')];
    for (const r of rx) {
      for (const line of lines) {
        if (!line.trim().startsWith('|')) continue;
        const cells = line.split('|').map(c => c.trim()).slice(1, -1);
        for (let i = 0; i < cells.length; i++) {
          const forms = variants(cells[i]);
          if (!forms.some(f => r.test(f))) continue;
          const at = forms[0].search(r);
          const tail = at >= 0 ? firstCount(forms[0].slice(at)) : null;
          if (tail !== null) return tail;
          if (at !== 0) {
            const head = firstCount(forms[0].slice(0, at));
            if (head !== null) return head;
          }
          if (cells[i + 1]) {
            const next = firstCount(cells[i + 1]);
            if (next !== null) return next;
          }
          return NaN;
        }
      }
    }
    return null;
  };

  const counts = [
    ['allowlist', TRUTH.allow, valueFor([
      /\bmodelos?\s+free\b/i, /\bfree\s+models?\b/i,
      /免费模型/, /免費模型/,
      /\bendpoints?\s+free\b/i
    ])],
    ['i18n', TRUTH.i18n, valueFor([
      /\bchaves\b/i, /\bkeys?\b/i,
      /i18n\s*键/, /个(?:翻译)?键/, /个键/
    ])]
  ];
  for (const [name, expected, got] of counts) {
    if (got === null) {
      report('erro', doc.id, name, `nao encontrei a contagem de ${name} (esperado ${expected})`);
    } else if (Number.isNaN(got)) {
      report('erro', doc.id, name, `a tabela menciona ${name} mas nao traz o numero (esperado ${expected})`);
    } else if (got !== expected) {
      report('erro', doc.id, name,
        `documenta ${got}, codigo tem ${expected} — divergencia de ${Math.abs(got - expected)}`);
    }
  }

  // 2. limites: o valor tem que estar na linha do rótulo do limite
  const lim = [
    ['rate-min', limits.maxMin, [/\breq\/min\b/i, /\brequests?\/min\b/i, /次\/分钟/]],
    ['rate-day', limits.maxDay, [/\breq\/dia\b/i, /\brequests?\/day\b/i, /\breq\/day\b/i, /次\/天/]],
    ['auto-block', limits.autoBlock, [/\bauto[\s_-]?block\b/i, /自动封禁/]],
    ['max-tokens', limits.maxOut, [/\bmax_output_tokens\b/i, /\bmaxTokens\b/i]],
  ['max-tokens-arq', limits.maxOutArq, [/\bmax_output_tokens_arquiteto\b/i]],
    ['body-kb', limits.bodyKB, [/\bmax_body_bytes\b/i, /\bbody\b/i]]
  ];
  for (const [name, val, pats] of lim) {
    if (val === null) {
      report('erro', doc.id, 'limite', `nao consegui ler ${name} do codigo`);
      continue;
    }
    const found = valueFor(pats);
    if (found === null) {
      report('erro', doc.id, 'limite', `falta o limite ${name} = ${val}`);
    } else if (Number.isNaN(found)) {
      report('erro', doc.id, 'limite', `a tabela menciona ${name} mas nao traz o numero (codigo tem ${val})`);
    } else if (found !== val) {
      report('erro', doc.id, 'limite', `${name}: documenta ${found}, codigo tem ${val}`);
    }
  }
  if (!matchesAny(t, P.fallback)) {
    report('aviso', doc.id, 'fallback', `nao menciona o fallback de ${limits.fallbackTry} modelos`);
  }
  if (!matchesAny(t, P.personas)) {
    report('erro', doc.id, 'personas', `nao afirma ${TRUTH.prompts}`);
  }
  if (!matchesAny(t, P.skills)) {
    report('erro', doc.id, 'skills', `nao afirma ${TRUTH.skills} skills`);
  }

  // 3. ids de modelo: todo id listado no README deve existir na allowlist
  // O roteador nao termina em ':free' (por escolha: e um roteador). Sem o
// segundo ramo ele nunca seria lido da tabela, e o checker acusaria a
// propria documentacao por omissao.
const listedIds = [...t.matchAll(/`([a-z0-9][a-z0-9._\-]*\/[a-z0-9._\-]+:free|openrouter\/free)`/gi)].map(m => m[1]);
  const bogus = [...new Set(listedIds)].filter(id => !allow.includes(id));
  if (bogus.length) {
    report('erro', doc.id, 'allowlist', `lista ids que nao estao em ALLOWED_MODELS: ${bogus.join(', ')}`);
  }
  const missing = allow.filter(id => !listedIds.includes(id));
  if (missing.length) {
    report('aviso', doc.id, 'allowlist', `nao lista ${missing.length} de ${allow.length} ids: ${missing.join(', ')}`);
  }

  // 4. skills: toda skill citada precisa existir
  const citedSkills = [...new Set([...t.matchAll(/`([a-z_]{3,12})`/g)].map(m => m[1]))];
  const bogusSkill = citedSkills.filter(s => /^(codigo|geral|financas|saude|visual|seguranca)$/.test(s) && !skills.includes(s));
  if (bogusSkill.length) report('erro', doc.id, 'skills', `cita skill inexistente: ${bogusSkill.join(', ')}`);

  // 5. personas do seletor citadas
  for (const per of personas) {
    if (!t.includes(`\`${per}\``)) {
      report('aviso', doc.id, 'personas', `nao menciona a persona \`${per}\``);
    }
  }

  // 6. versão — a versão "atual" declarada tem que ser a de package.json.
  // Histórico de changelog pode citar versões antigas, então procuramos o
  // rótulo de versão atual, não qualquer número no arquivo.
  const VERSION_LABELS = '(?:version|versão|versao|版本)';
  const curVer = t.match(
    new RegExp(VERSION_LABELS + '[^0-9]{0,30}?(\\d+\\.\\d+(?:\\.\\d+)?)', 'i')
  ) || t.match(
    new RegExp('(\\d+\\.\\d+(?:\\.\\d+)?)[^0-9]{0,30}?' + VERSION_LABELS, 'i')
  );
  if (!curVer) {
    report('erro', doc.id, 'versao', `nao encontrei a versao declarada (esperado ${pkg.version})`);
  } else if (curVer[1] !== pkg.version) {
    report('erro', doc.id, 'versao', `documenta ${curVer[1]}, package.json tem ${pkg.version}`);
  }

  // 7. links relativos — resolvidos a partir do diretório do próprio documento.
  // Não stripamos "../": um link que sobe da pasta é exatamente o link vago que
  // o portfolio não pode ter, porque é publicado sozinho.
  // A exclusão é por esquema inteiro, e não por "https?": um mailto: também não
  // é arquivo, e uma lista parcial trataria e-mail como caminho quebrado.
  for (const m of t.matchAll(/\]\((?![a-z][a-z0-9+.-]*:)([^)#\s]+)\)/g)) {
    const target = path.resolve(path.dirname(path.join(ROOT, doc.file)), m[1].split('#')[0]);
    if (!existsSync(target)) {
      report('erro', doc.id, 'link', `link quebrado: ${m[1]}`);
    } else if (!target.startsWith(ROOT + path.sep)) {
      report('erro', doc.id, 'link', `link sai da pasta, que é publicada sozinha: ${m[1]}`);
    }
  }

  // 8. encoding — só o ZH legitimamente contém CJK. PT e EN não, e o rótulo do
  // idioma aparece como "中文", o que é permitido.
  if (!doc.id.endsWith('zh')) {
    const bad = t.split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => /[　-鿿]|[가-힯]|[Ѐ-ӿ]/.test(l)
        && !/中文/.test(l));
    if (bad.length) {
      report('erro', doc.id, 'encoding',
        `${bad.length} linha(s) com caractere CJK/cirilico corrompido: L${bad.map(b => b[0]).slice(0, 6).join(', L')}`);
    }
  }
}
console.log('');

// --- autossuficiência ---------------------------------------------------
// O portfolio é publicado como repositório separado, então NENHUM arquivo
// dentro dele pode apontar para fora da pasta: nem por caminho relativo, nem
// por link absoluto para um repositório, nem por promessa em prosa.
//
// A varredura cobre .md, .yml/.yaml e .mjs — não só markdown. Um workflow que
// dispara "o CI do repositório de origem" ou um script que aponta para um
// caminho de fora quebra o portfolio exatamente do mesmo jeito que uma frase
// num README, e o README não é o único lugar onde essa promessa aparece.
console.log('# autossuficiencia do portfolio');
const SELF_SUFFICIENT_EXT = new Set(['.md', '.yml', '.yaml', '.mjs']);
const SCANNED = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (SELF_SUFFICIENT_EXT.has(path.extname(entry).toLowerCase())) SCANNED.push(full);
  }
})(ROOT);
SCANNED.sort();
// O próprio checker cita os termos que procura; incluir-se aqui faria ele acusar
// a si mesmo em toda execução.
const SELF = path.join(ROOT, 'scripts', 'check-readme-parity.mjs');
const MARKDOWN = SCANNED.filter(f => f !== SELF);

for (const full of MARKDOWN) {
  const rel = path.relative(ROOT, full).replace(/\\/g, '/');
  const t = readFileSync(full, 'utf8');

  if (/governance\//.test(t)) {
    report('erro', rel, 'autossuficiente', 'menciona governance/, que nao e publicado junto');
  }
  // Link absoluto para um repositório GitHub: link morto para quem só tem o
  // portfolio, e expõe um documento que a gente decidiu manter privado.
  //
  // A regra casta QUALQUER github.com/<owner>/<repo>, em vez de um org fixo.
  // Fixar "shipclawdev" faz o check depender de um fato externo que ele mesmo
  // deveria vigiar: se o repositório de origem fosse renomeado, movido ou
  // apagado, o padrão antigo deixaria de casar e o check passaria calado — que
  // é exatamente a falha que ele existe para evitar. Links para projetos de
  // terceiros usam outro domínio (github.github.com/gfm) e não casam aqui.
  const ext = [...t.matchAll(/https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g)].map(m => m[0]);
  if (ext.length) {
    report('erro', rel, 'autossuficiente',
      `link para o repositorio de origem, que nao viaja junto: ${[...new Set(ext)].join(', ')}`);
  }
  // A mesma ideia em prosa, e nos três idiomas. A flag "g" é obrigatória: o
  // `matchAll` abaixo lança TypeError sem ela. E o `lastIndex` que ela grava
  // não atrapalha aqui, porque o `matchAll` opera sobre uma cópia da regex e
  // não sobre o objeto do array.
  const ORIGIN_PROSE = [
    /reposit[oó]rio de origem/gi,
    /repo de origem/gi,
    /source repo(?:sitory)?/gi,
    /源码仓库/gi,
    /源仓库/gi,
    /原始仓库/gi
  ];
  const prosa = [...new Set(ORIGIN_PROSE.flatMap(r => [...t.matchAll(r)].map(m => m[0].trim())))];
  if (prosa.length) {
    report('erro', rel, 'autossuficiente',
      `promete uma garantia que fica fora da pasta: ${prosa.join(', ')}`);
  }
  const up = [...new Set([...t.matchAll(/`(\.\.\/[^`\n]+)`/g)].map(m => m[1]))];
  if (up.length) {
    report('erro', rel, 'autossuficiente', `menciona caminho que sai da pasta: ${up.join(', ')}`);
  }
  // A exclusão é por esquema inteiro, e não por "https?": um mailto: também não
  // é arquivo, e uma lista parcial trataria e-mail como caminho quebrado.
  for (const m of t.matchAll(/\]\((?![a-z][a-z0-9+.-]*:)([^)#\s]+)\)/g)) {
    const target = path.resolve(path.dirname(full), m[1].split('#')[0]);
    if (!existsSync(target)) {
      report('erro', rel, 'link', `link quebrado: ${m[1]}`);
    } else if (!target.startsWith(ROOT + path.sep)) {
      report('erro', rel, 'autossuficiente', `link sai da pasta, que é publicada sozinha: ${m[1]}`);
    }
  }
}
console.log(`  ${MARKDOWN.length} arquivo(s) verificado(s): .md, .yml, .mjs`);
console.log('');

// --- paridade entre idiomas ---------------------------------------------
console.log('# paridade entre idiomas');
const loaded = {};
for (const doc of DOCS) {
  const p = path.join(ROOT, doc.file);
  if (existsSync(p)) loaded[doc.id] = read(doc.file);
}

if (Object.keys(loaded).length === DOCS.length) {
  const EN = DOCS[0];
  const enSecs = (loaded.en.match(/^##\s+/gm) || []).length;
  for (const doc of DOCS.slice(1)) {
    const secs = (loaded[doc.id].match(/^##\s+/gm) || []).length;
    if (secs !== enSecs) {
      report('erro', doc.id, 'secoes',
        `${secs} secoes de nivel 2 contra ${enSecs} em ${EN.file} (paridade exige igual)`);
    }
    for (const [name, val] of [['allowlist', TRUTH.allow], ['i18n', TRUTH.i18n]]) {
      const re = new RegExp(`\\b${val}\\b`);
      if (!re.test(loaded[doc.id])) {
        report('erro', doc.id, 'paridade', `contagem de ${name} (${val}) ausente em ${doc.file}`);
      }
    }
  }
  // checagem de negativos: número não pode aparecer onde não deve
  for (const doc of DOCS) {
    const t = loaded[doc.id];
    for (const dead of ['ling-3.0-flash-fin', 'ling-3.0-flash-vl', 'nex-agi/']) {
      const re = new RegExp(`${dead}[^\\n]{0,40}`);
      if (re.test(t) && !/remov|retir|dead|dead id|obsolet|已移除|已删除|descontinuad|no longer/i.test(
        t.match(re) ? t.match(re)[0] : ''
      )) {
        report('erro', doc.id, 'modelo-morto', `menciona "${dead}" sem marcar como removido`);
      }
    }
  }
} else {
  report('aviso', 'paridade', 'docs', 'faltam versoes; paridade entre idiomas nao verificada');
}
console.log('');

// --- resultado ----------------------------------------------------------
console.log('============================================================');
console.log(`erros: ${errors.length}   avisos: ${warnings.length}   info: ${infos.length}`);
if (errors.length) {
  console.log('\nErros:');
  for (const e of errors) console.log(`  - [${e.doc}] ${e.check}: ${e.msg}`);
}
if (warnings.length) {
  console.log('\nAvisos:');
  for (const w of warnings) console.log(`  - [${w.doc}] ${w.check}: ${w.msg}`);
}

const failed = errors.length > 0 || (STRICT && warnings.length > 0);
console.log(`\n${failed ? 'FALHOU' : 'OK'}`);
process.exit(failed ? 1 : 0);
