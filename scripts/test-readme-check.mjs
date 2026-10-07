#!/usr/bin/env node
// Prova que o checker do portfolio NAO é vácuo.
//
// Um checker que só aprova não prova nada: se a lógica de conferência quebrar
// um dia, o CI continua verde e a documentação volta a mentir. Aqui corrompemos
// um número de propósito e exigimos que o checker reclame.
//
// Este teste é o guard mínimo que precisa viajar com o portfolio: a suíte
// completa de mutações fica na raiz (scripts/test-readme-check.mjs), que tem
// CI para rodá-la. Se este arquivo falhar ao mudar de pasta, o portfolio perdeu
// a única prova de que o próprio check ainda funciona.
//
// O original fica em memória e é restaurado no finally, mesmo se a mutação
// estourar: um teste que corrompe o repo quando falha é pior que um teste que
// não existe.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKER = join(ROOT, 'scripts', 'check-readme-parity.mjs');
const TARGET = 'README_PT.md';

const orig = readFileSync(join(ROOT, TARGET), 'utf8');

function run() {
  try {
    return { code: 0, out: execFileSync('node', [CHECKER], { encoding: 'utf8', cwd: ROOT }) };
  } catch (e) {
    return { code: e.status, out: e.stdout || '' };
  }
}

// O alvo da mutação vem do código, nunca de um literal: contamos o dicionário
// de i18n como o checker conta e perturbamos em cima desse número. Com "263"
// escrito à mão, a contagem mudou e a substituição ficou sem alvo — o teste
// acusou "a mutação não mudou nada" em vez de passar calado, que é o
// comportamento correto do abort sobre uma mutação que envelheceu.
const i18nCount = (rel) => {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  return (src.match(/"([a-zA-Z0-9_.\-]+)":\s*\{\s*pt:/g) || []).length;
};
const I18N = i18nCount('site/app.js');
const WRONG = String(I18N - 1);

const mutated = orig.replace(new RegExp(`\\*\\*${I18N}\\*\\*`), `**${WRONG}**`);
if (mutated === orig) {
  console.error(`  ABORTADO  a mutacao nao mudou nada em ${TARGET}: o texto-alvo mudou`);
  process.exit(1);
}

let pass = 0;
let fail = 0;
let restored = 1;
// Não chamamos process.exit dentro do try: isso pula o finally e deixa o repo
// corrompido. Sinalizamos e saímos; o exit vem depois do finally.
let abort = null;

try {
  // Sanidade: intacto, o checker tem de passar.
  const clean = run();
  if (clean.code !== 0) {
    abort = ['o checker ja falha antes de qualquer mutacao', clean.out];
  } else {
    writeFileSync(join(ROOT, TARGET), mutated);
    const r = run();
    if (r.code !== 0 && /i18n|262/.test(r.out)) {
      pass++;
      console.log('  DETECTOU  contagem de i18n corrompida');
    } else {
      fail++;
      console.log(`  ESCAPOU   contagem de i18n corrompida  (exit=${r.code})`);
    }
  }
} finally {
  writeFileSync(join(ROOT, TARGET), orig);
  const final = run();
  restored = final.code;
  console.log(`\n  ${pass} detectados, ${fail} escaparam`);
  console.log(`  restaurado: exit=${restored} ${restored === 0 ? '(OK)' : '(FALHOU)'}`);
}

if (abort) {
  console.error(`  ABORTADO  ${abort[0]}`);
  if (abort[1]) console.error(abort[1]);
  process.exit(1);
}

process.exit(fail === 0 && restored === 0 ? 0 : 1);
