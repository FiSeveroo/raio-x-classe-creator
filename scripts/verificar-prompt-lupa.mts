/*
 * Confere se o prompt da Lupa em src/lib/lupa/prompt.ts é IDÊNTICO ao do
 * app.py legado (classificar_com_claude), caractere por caractere.
 *
 * Como não dependemos de Python: o script extrai do app.py o texto dos dois
 * f-strings (prompt_sistema e payload), aplica as regras de f-string
 * (continuação com "\" + quebra de linha, "{{"/"}}" e substituição das
 * expressões) e compara com a saída do TypeScript para os mesmos dados.
 *
 * Uso: node scripts/verificar-prompt-lupa.mts [caminho/do/app.py]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { codigosConteudo, codigosProdutor, tipologiaParaPrompt } from "../src/lib/tipologia.ts";
import {
  montarExemplosDinamicos,
  montarPayload,
  montarPromptSistema,
  type ExemploAncora,
} from "../src/lib/lupa/prompt.ts";

const app = readFileSync(resolve(process.argv[2] ?? "../raio-x-classe-creator/app.py"), "utf8").replace(/\r\n/g, "\n");

function extrairFString(marcador: string): string {
  const i = app.indexOf(marcador);
  if (i === -1) throw new Error(`Não achei ${marcador} no app.py`);
  const ini = i + marcador.length;
  const fim = app.indexOf('"""', ini);
  return app.slice(ini, fim);
}

/** Aplica f-string: "\"+newline some, expressões viram valores, {{ }} viram { }. */
function renderizar(tpl: string, valores: Record<string, string>): string {
  let s = tpl.replace(/\\\n/g, "");
  const faltando: string[] = [];
  s = s.replace(/\{\{|\}\}|\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, (m, expr) => {
    if (m === "{{") return "{";
    if (m === "}}") return "}";
    if (!(expr in valores)) faltando.push(expr);
    return valores[expr] ?? `<<${expr}>>`;
  });
  if (faltando.length) throw new Error(`Expressões sem valor no verificador: ${faltando.join(" | ")}`);
  return s;
}

function comparar(nome: string, esperado: string, obtido: string): boolean {
  if (esperado === obtido) {
    console.log(`✓ ${nome}: idêntico (${esperado.length} caracteres)`);
    return true;
  }
  let i = 0;
  while (i < esperado.length && esperado[i] === obtido[i]) i++;
  console.error(`✗ ${nome}: difere a partir do caractere ${i}`);
  console.error(`  app.py: ${JSON.stringify(esperado.slice(Math.max(0, i - 40), i + 60))}`);
  console.error(`  ts    : ${JSON.stringify(obtido.slice(Math.max(0, i - 40), i + 60))}`);
  return false;
}

let ok = true;

// ---------------- prompt de sistema (3 cenários de exemplos) ----------------
const tplSistema = extrairFString('prompt_sistema = f"""');
const cenarios: [string, ExemploAncora[]][] = [
  ["sem exemplos", []],
  [
    "com exemplos",
    [
      { canal_nome: "CazéTV", tipo_produtor: "produtora_digital", justificativa: "Marca de mídia esportiva com dezenas de apresentadores e estrutura empresarial própria; não depende de uma persona" },
      { canal_nome: "Casimiro", tipo_produtor: "youtuber_profissional", justificativa: "" },
      { canal_nome: "Canal 🎮 com emoji", tipo_produtor: "criador_casual", justificativa: "🎮".repeat(90) },
    ],
  ],
  ["exemplo com justificativa nula", [{ canal_nome: "X", tipo_produtor: "marca", justificativa: null }]],
];

for (const [nome, exemplos] of cenarios) {
  // Lado Python: replica o laço de app.py linhas ~784-794 sobre os mesmos dados.
  let exemplosPy = "";
  try {
    if (exemplos.length) {
      const linhas = exemplos.map((ex) => {
        if (ex.justificativa === null) throw new TypeError("'NoneType' object is not subscriptable");
        const just = Array.from(ex.justificativa).slice(0, 80).join("");
        return `- ${ex.canal_nome} → ${ex.tipo_produtor}${just ? ` [${just}]` : ""}`;
      });
      exemplosPy = "\n\nEXEMPLOS VALIDADOS PELO PESQUISADOR (aprendizado acumulado):\n" + linhas.join("\n");
    }
  } catch {
    exemplosPy = ""; // o except Exception: pass do Python
  }

  const esperado = renderizar(tplSistema, {
    "tipologia_para_prompt()": tipologiaParaPrompt(),
    '", ".join(codigos_produtor())': codigosProdutor().join(", "),
    '", ".join(codigos_conteudo())': codigosConteudo().join(", "),
    exemplos_dinamicos: exemplosPy,
  });
  ok = comparar(`prompt de sistema (${nome})`, esperado, montarPromptSistema(montarExemplosDinamicos(exemplos))) && ok;
}

// ---------------- payload (2 cenários de canal) ----------------
const tplPayload = extrairFString('payload = f"""');
const video = {
  titulo: "Título com “aspas”, emoji 🎬 e acento",
  canal_nome: "Canal Teste",
  visualizacoes: 1234567,
  tags: Array.from({ length: 25 }, (_, i) => `tag${i}`),
  descricao: "🎥".repeat(2100),
};
const milharPy = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const corte = (s: string, n: number) => Array.from(s).slice(0, n).join("");

const canais: [string, { canal_descricao?: string; inscritos?: number; total_videos?: number }][] = [
  ["canal encontrado", { canal_descricao: "Descrição 🙏 ".repeat(200), inscritos: 41600000, total_videos: 8123 }],
  ["canal não encontrado ({})", {}],
];
for (const [nome, canal] of canais) {
  const esperado = renderizar(tplPayload, {
    "meta_video['titulo']": video.titulo,
    "meta_video['canal_nome']": video.canal_nome,
    "meta_canal.get('inscritos', 0):,": milharPy(canal.inscritos ?? 0),
    "meta_canal.get('total_videos', 0):,": milharPy(canal.total_videos ?? 0),
    "meta_video['visualizacoes']:,": milharPy(video.visualizacoes),
    "', '.join(meta_video['tags'][:20]) if meta_video['tags'] else '(sem tags)'": video.tags.slice(0, 20).join(", "),
    "meta_canal.get('canal_descricao', '(sem descrição)')[:1500]": corte(
      "canal_descricao" in canal ? canal.canal_descricao! : "(sem descrição)",
      1500,
    ),
    "meta_video['descricao'][:2000]": corte(video.descricao, 2000),
  });
  ok = comparar(`payload (${nome})`, esperado, montarPayload(video, canal)) && ok;
}

// ---------------- parâmetros da chamada ----------------
const chamada = app.slice(app.indexOf("resposta = cliente.messages.create("), app.indexOf("texto = resposta.content[0].text"));
const modelo = chamada.match(/model="([^"]+)"/)?.[1];
const maxTokens = chamada.match(/max_tokens=(\d+)/)?.[1];
const fonteTs = readFileSync(resolve("src/lib/lupa/classificar.ts"), "utf8");
for (const [nome, valorPy, padraoTs] of [
  ["modelo", modelo, /MODELO_LUPA = "([^"]+)"/],
  ["max_tokens", maxTokens, /MAX_TOKENS_LUPA = (\d+)/],
] as const) {
  const valorTs = fonteTs.match(padraoTs)?.[1];
  if (valorPy && valorPy === valorTs) console.log(`✓ ${nome}: ${valorTs}`);
  else {
    console.error(`✗ ${nome}: app.py=${valorPy} ts=${valorTs}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log("✓ Prompt da Lupa idêntico ao app.py");
