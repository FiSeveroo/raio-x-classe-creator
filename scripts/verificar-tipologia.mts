/*
 * Confere se src/lib/tipologia.ts é idêntica ao tipologia.py do repo legado
 * (códigos, nomes, definições e sinais em PT). A tipologia alimenta os
 * prompts do Claude: qualquer divergência muda a classificação.
 *
 * Uso: node scripts/verificar-tipologia.ts [caminho/do/tipologia.py]
 * Padrão: ../raio-x-classe-creator/tipologia.py
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONTEUDOS, PRODUTORES } from "../src/lib/tipologia.ts";

const caminho = resolve(process.argv[2] ?? "../raio-x-classe-creator/tipologia.py");
const py = readFileSync(caminho, "utf8");

/** Junta literais "..." adjacentes (concatenação implícita do Python). */
function literais(trecho: string): string {
  return [...trecho.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
    .map((m) => m[1].replace(/\\(["\\])/g, "$1"))
    .join("");
}

type Cat = { codigo: string; nome: string; definicao: string; sinais: string };

function extrair(bloco: string): Cat[] {
  return [...bloco.matchAll(/Categoria\(([\s\S]*?)\n\s{4}\),/g)].map(([, corpo]) => ({
    codigo: literais(corpo.match(/codigo=([^\n]*)/)![1]),
    nome: literais(corpo.match(/nome=([^\n]*)/)![1]),
    definicao: literais(corpo.match(/definicao=\(([\s\S]*?)\n\s{8}\)/)![1]),
    sinais: literais(corpo.match(/sinais=\(([\s\S]*?)\n\s{8}\)/)![1]),
  }));
}

const [, blocoA, blocoB] = py.split(/^(?:PRODUTORES|CONTEUDOS) = \[/m);
const eixos: [string, Cat[], typeof PRODUTORES][] = [
  ["Eixo A", extrair(blocoA), PRODUTORES],
  ["Eixo B", extrair(blocoB.split(/^\]/m)[0]), CONTEUDOS],
];

let erros = 0;
for (const [nomeEixo, doPython, doTs] of eixos) {
  if (doPython.length !== doTs.length) {
    console.error(`✗ ${nomeEixo}: ${doPython.length} categorias no Python, ${doTs.length} no TS`);
    erros++;
  }
  doPython.forEach((p, i) => {
    const t = doTs[i];
    const pares: [string, string, string][] = [
      ["codigo", p.codigo, t?.codigo],
      ["nome", p.nome, t?.nome.pt],
      ["definicao", p.definicao, t?.definicao.pt],
      ["sinais", p.sinais, t?.sinais],
    ];
    for (const [campo, a, b] of pares) {
      if (a !== b) {
        console.error(`✗ ${nomeEixo} [${p.codigo}] ${campo} difere\n  py: ${a}\n  ts: ${b}`);
        erros++;
      }
    }
  });
  console.log(`${nomeEixo}: ${doPython.length} categorias conferidas`);
}

if (erros) {
  console.error(`\n${erros} divergência(s).`);
  process.exit(1);
}
console.log("✓ tipologia.ts idêntica ao tipologia.py");
