/*
 * Confere se TODOS os prompts portados são idênticos aos do app.py legado,
 * caractere por caractere — sem depender de Python.
 *
 * Para cada prompt: extrai o texto do f-string de dentro da função certa do
 * app.py, aplica as regras de f-string (continuação com "\" + quebra de
 * linha, "{{"/"}}" e substituição das expressões por valores calculados com
 * a semântica do Python) e compara com a saída do TypeScript para os mesmos
 * dados de teste. Também confere modelo e max_tokens de cada chamada.
 *
 * Uso: node scripts/verificar-prompts.mts [caminho/do/app.py]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { codigosConteudo, codigosProdutor, tipologiaParaPrompt } from "../src/lib/tipologia.ts";
import { pyCorte, pyFixed, pyInt, pyMilhar, pyStr } from "../src/lib/py.ts";
import * as lupa from "../src/lib/lupa/prompt.ts";
import * as dossie from "../src/lib/dossie/prompts.ts";
import type { Sintomas } from "../src/lib/dossie/sintomas.ts";
import { duracaoIsoParaSegundos, type ItemVideoApi } from "../src/lib/youtube-util.ts";

const app = readFileSync(resolve(process.argv[2] ?? "../raio-x-classe-creator/app.py"), "utf8").replace(/\r\n/g, "\n");

/** Corpo da função `def nome(` até a próxima def de nível 0. */
function corpoFuncao(nome: string): string {
  const ini = app.indexOf(`\ndef ${nome}(`);
  if (ini === -1) throw new Error(`Função ${nome} não encontrada no app.py`);
  const fim = app.indexOf("\ndef ", ini + 5);
  return app.slice(ini, fim === -1 ? undefined : fim);
}

/** Texto cru de um f-string ("""...""") ou string ("""...""") dentro de uma função. */
function extrair(funcao: string, marcador: string): string {
  const corpo = corpoFuncao(funcao);
  const i = corpo.indexOf(marcador);
  if (i === -1) throw new Error(`Não achei ${marcador} em ${funcao}`);
  const ini = i + marcador.length;
  return corpo.slice(ini, corpo.indexOf('"""', ini));
}

/** Aplica f-string: "\"+newline some, {{ }} viram { }, expressões viram valores. */
function renderizar(tpl: string, valores: Record<string, string>, ehF = true): string {
  let s = tpl.replace(/\\\n/g, "");
  if (!ehF) return s;
  const faltando: string[] = [];
  s = s.replace(/\{\{|\}\}|\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g, (m, expr) => {
    if (m === "{{") return "{";
    if (m === "}}") return "}";
    if (!(expr in valores)) faltando.push(expr);
    return valores[expr] ?? `<<${expr}>>`;
  });
  if (faltando.length) throw new Error(`Expressões sem valor no verificador:\n  ${faltando.join("\n  ")}`);
  return s;
}

let ok = true;
function comparar(nome: string, esperado: string, obtido: string) {
  if (esperado === obtido) {
    console.log(`✓ ${nome} (${esperado.length} caracteres)`);
    return;
  }
  ok = false;
  let i = 0;
  while (i < esperado.length && esperado[i] === obtido[i]) i++;
  console.error(`✗ ${nome}: difere a partir do caractere ${i}`);
  console.error(`  app.py: ${JSON.stringify(esperado.slice(Math.max(0, i - 50), i + 60))}`);
  console.error(`  ts    : ${JSON.stringify(obtido.slice(Math.max(0, i - 50), i + 60))}`);
}

/** Confere model= e max_tokens= da chamada messages.create dentro da função. */
function conferirChamada(funcao: string, modeloTs: string, maxTs: number) {
  const corpo = corpoFuncao(funcao);
  const chamada = corpo.slice(corpo.indexOf("messages.create("));
  const modelo = chamada.match(/model="([^"]+)"/)?.[1];
  const max = Number(chamada.match(/max_tokens=(\d+)/)?.[1]);
  if (modelo === modeloTs && max === maxTs) console.log(`✓ ${funcao}: ${modelo}, max_tokens=${max}`);
  else {
    ok = false;
    console.error(`✗ ${funcao}: app.py=${modelo}/${max} ts=${modeloTs}/${maxTs}`);
  }
}

const tip = {
  "tipologia_para_prompt()": tipologiaParaPrompt(),
  '", ".join(codigos_produtor())': codigosProdutor().join(", "),
  '", ".join(codigos_conteudo())': codigosConteudo().join(", "),
};

/** Laço de exemplos âncora do Python (com o TypeError de None[:80] engolido). */
function exemplosPython(exs: lupa.ExemploAncora[], cabecalho: string) {
  try {
    if (!exs.length) return "";
    const linhas = exs.map((ex) => {
      if (ex.justificativa === null) throw new TypeError();
      const just = pyCorte(ex.justificativa!, 80);
      return `- ${pyStr(ex.canal_nome)} → ${pyStr(ex.tipo_produtor)}${just ? ` [${just}]` : ""}`;
    });
    return cabecalho + linhas.join("\n");
  } catch {
    return "";
  }
}

const EXEMPLOS: [string, lupa.ExemploAncora[]][] = [
  ["sem exemplos", []],
  [
    "com exemplos",
    [
      { canal_nome: "CazéTV", tipo_produtor: "produtora_digital", justificativa: "Marca de mídia esportiva com dezenas de apresentadores e estrutura empresarial própria; não depende de uma persona" },
      { canal_nome: "Casimiro", tipo_produtor: "youtuber_profissional", justificativa: "" },
      { canal_nome: null, tipo_produtor: "criador_casual", justificativa: "🎮".repeat(90) },
    ],
  ],
  ["justificativa nula", [{ canal_nome: "X", tipo_produtor: "marca", justificativa: null }]],
];

// ============================== LUPA ==============================
{
  const tpl = extrair("classificar_com_claude", 'prompt_sistema = f"""');
  for (const [nome, exs] of EXEMPLOS) {
    const esperado = renderizar(tpl, {
      ...tip,
      exemplos_dinamicos: exemplosPython(exs, "\n\nEXEMPLOS VALIDADOS PELO PESQUISADOR (aprendizado acumulado):\n"),
    });
    comparar(`Lupa · sistema (${nome})`, esperado, lupa.montarPromptSistema(lupa.montarExemplosDinamicos(exs)));
  }

  const tplP = extrair("classificar_com_claude", 'payload = f"""');
  const video = {
    titulo: "Título com “aspas”, emoji 🎬 e acento",
    canal_nome: "Canal Teste",
    visualizacoes: 1234567,
    tags: Array.from({ length: 25 }, (_, i) => `tag${i}`),
    descricao: "🎥".repeat(2100),
  };
  const canais: [string, lupa.CanalPayload][] = [
    ["canal encontrado", { canal_descricao: "Descrição 🙏 ".repeat(200), inscritos: 41600000, total_videos: 8123 }],
    ["canal {}", {}],
  ];
  for (const [nome, canal] of canais) {
    const esperado = renderizar(tplP, {
      "meta_video['titulo']": video.titulo,
      "meta_video['canal_nome']": video.canal_nome,
      "meta_canal.get('inscritos', 0):,": pyMilhar(canal.inscritos ?? 0),
      "meta_canal.get('total_videos', 0):,": pyMilhar(canal.total_videos ?? 0),
      "meta_video['visualizacoes']:,": pyMilhar(video.visualizacoes),
      "', '.join(meta_video['tags'][:20]) if meta_video['tags'] else '(sem tags)'": video.tags.slice(0, 20).join(", "),
      "meta_canal.get('canal_descricao', '(sem descrição)')[:1500]": pyCorte(
        "canal_descricao" in canal ? canal.canal_descricao! : "(sem descrição)",
        1500,
      ),
      "meta_video['descricao'][:2000]": pyCorte(video.descricao, 2000),
    });
    comparar(`Lupa · payload (${nome})`, esperado, lupa.montarPayload(video, canal));
  }
  const fonte = readFileSync(resolve("src/lib/lupa/classificar.ts"), "utf8");
  conferirChamada(
    "classificar_com_claude",
    fonte.match(/MODELO_LUPA = "([^"]+)"/)![1],
    Number(fonte.match(/MAX_TOKENS_LUPA = (\d+)/)![1]),
  );
}

// ============================== DOSSIÊ ==============================
{
  const tpl = extrair("classificar_canal_haiku", 'prompt_sistema = f"""');
  for (const [nome, exs] of EXEMPLOS) {
    const esperado = renderizar(tpl, {
      ...tip,
      exemplos_dinamicos_haiku: exemplosPython(exs, "\n\nEXEMPLOS VALIDADOS PELO PESQUISADOR:\n"),
    });
    comparar(`Dossiê · sistema canal (${nome})`, esperado, dossie.montarPromptCanal(dossie.montarExemplosCanal(exs)));
  }

  const video = (i: number, extra: Partial<ItemVideoApi["snippet"]> = {}): ItemVideoApi => ({
    id: `v${i}`,
    snippet: {
      title: `Vídeo ${i} — título longo `.repeat(i % 3 === 0 ? 10 : 1) + (i % 4 === 0 ? "🔥" : ""),
      description: i % 2 ? `Descrição ${i} com link https://loja.exemplo.com/p${i} `.repeat(15) : "",
      tags: i % 5 ? [] : ["a", "b", "c", "d", "e", "f", "g", "h"],
      channelId: "UC_x",
      channelTitle: "Canal X",
      publishedAt: `2026-09-${String(10 + (i % 18)).padStart(2, "0")}T12:00:00Z`,
      ...extra,
    },
    contentDetails: { duration: i % 3 ? `PT${i}M${i}S` : `PT${i * 3}S` },
  });
  const videos = Array.from({ length: 12 }, (_, i) => video(i + 1));
  const canal = {
    id: "UC_x",
    snippet: { title: "Canal “X” 🎬", description: "Somos uma equipe 🙏 ".repeat(200), publishedAt: "2015-03-04T10:00:00Z" },
    statistics: { subscriberCount: "41600000", videoCount: "8123", viewCount: "9876543210" },
  };
  const canalComPais = { ...canal, snippet: { ...canal.snippet, country: "BR" } };

  const sintomasBase: Sintomas = {
    frequencia_videos_por_dia: 0.7368421052631579,
    frequencia_shorts_por_dia: null,
    frequencia_longos_por_dia: 0.5,
    duracao_mediana_segundos: 630,
    duracao_mediana_geral_segundos: 400,
    total_shorts: 4,
    total_longos: 8,
    total_inconclusivos: 0,
    pct_shorts: 33.33333333333333,
    link_externo_repetido: { dominio: "loja.exemplo.com", n_aparicoes: 90 },
    pct_titulos_padronizados: 12.5, // empate: Python dá "12", JS toFixed daria "13"
    taxa_engajamento_mediana: 4.125, // empate em .2f
    inscritos: 41600000,
    total_videos_canal: 8123,
    n_videos_analisados: 12,
  };
  const variacoes: [string, Sintomas, typeof canal][] = [
    ["completo", sintomasBase, canal],
    ["sem engajamento, sem link, com país", { ...sintomasBase, taxa_engajamento_mediana: null, link_externo_repetido: null, pct_titulos_padronizados: 87.5 }, canalComPais],
  ];

  const tplP = extrair("classificar_canal_haiku", 'payload = f"""');
  for (const [nome, s, c] of variacoes) {
    const sn = c.snippet as Record<string, string>;
    const amostra = videos
      .slice(0, 10)
      .map((v) => `  - [${duracaoIsoParaSegundos(v.contentDetails!.duration!)}s] ${pyCorte(v.snippet.title, 120)}`)
      .join("\n");
    const eng = s.taxa_engajamento_mediana !== null ? `${pyFixed(s.taxa_engajamento_mediana, 2)}%` : "indisponível";
    const esperado = renderizar(tplP, {
      "snippet.get('title', '')": sn.title,
      "int(stats.get('subscriberCount', 0)):,": pyMilhar(pyInt(c.statistics.subscriberCount)),
      "int(stats.get('videoCount', 0)):,": pyMilhar(pyInt(c.statistics.videoCount)),
      "int(stats.get('viewCount', 0)):,": pyMilhar(pyInt(c.statistics.viewCount)),
      "snippet.get('publishedAt', '')[:10]": pyCorte(sn.publishedAt, 10),
      "snippet.get('country', 'não declarado')": "country" in sn ? sn.country : "não declarado",
      "snippet.get('description', '(sem descrição)')[:2500]": pyCorte(sn.description, 2500),
      "len(videos)": String(videos.length),
      "sintomas['frequencia_videos_por_dia']:.2f": pyFixed(s.frequencia_videos_por_dia!, 2),
      "sintomas['duracao_mediana_segundos']": String(s.duracao_mediana_segundos),
      "sintomas['duracao_mediana_segundos']/60:.1f": pyFixed(s.duracao_mediana_segundos / 60, 1),
      "f\"{sintomas['taxa_engajamento_mediana']:.2f}%\" if sintomas.get('taxa_engajamento_mediana') is not None else 'indisponível'": eng,
      "sintomas['pct_titulos_padronizados']:.0f": pyFixed(s.pct_titulos_padronizados, 0),
      "sintomas['link_externo_repetido'] or 'nenhum'": s.link_externo_repetido ? pyStr(s.link_externo_repetido) : "nenhum",
      amostra_txt: amostra,
    });
    comparar(`Dossiê · payload canal (${nome})`, esperado, dossie.montarPayloadCanal(c, videos, s));
  }
  // Sanidade do arredondamento estilo Python (empate → par).
  for (const [x, casas, py] of [[12.5, 0, "12"], [13.5, 0, "14"], [0.125, 2, "0.12"], [4.125, 2, "4.12"], [2.675, 2, "2.67"], [33.333, 0, "33"]] as const) {
    const r = pyFixed(x, casas);
    if (r !== py) {
      ok = false;
      console.error(`✗ pyFixed(${x}, ${casas}) = ${r}, Python dá ${py}`);
    }
  }
  console.log("✓ arredondamento .Nf igual ao do Python (empates para o par)");
  conferirChamada("classificar_canal_haiku", dossie.MODELO_CANAL, dossie.MAX_TOKENS_CANAL);

  // Lote Eixo B
  const tplB = extrair("classificar_lote_eixo_b", 'prompt_sistema = f"""');
  comparar("Dossiê · sistema lote Eixo B", renderizar(tplB, tip), dossie.montarPromptLoteB());
  {
    const blocos = videos.map((v, i) => {
      const t = pyCorte(v.snippet.title, 200);
      const d = pyCorte(v.snippet.description ?? "", 300);
      const tags = (v.snippet.tags ?? []).slice(0, 6).join(", ");
      let b = `[${i + 1}] TÍTULO: ${t}`;
      if (d) b += `\n    DESCRIÇÃO: ${d}`;
      if (tags) b += `\n    TAGS: ${tags}`;
      return b;
    });
    // content=f"VÍDEOS A CLASSIFICAR:\n\n{payload_videos}"
    const linha = corpoFuncao("classificar_lote_eixo_b").match(/"content": f"([^"]+)"/)![1];
    const esperado = linha.replace(/\\n/g, "\n").replace("{payload_videos}", blocos.join("\n\n"));
    comparar("Dossiê · payload lote Eixo B", esperado, dossie.montarPayloadLoteB(videos));
  }
  conferirChamada("classificar_lote_eixo_b", dossie.MODELO_LOTE_B, dossie.MAX_TOKENS_LOTE_B);

  // Veredito
  comparar("Dossiê · sistema veredito", renderizar(extrair("emitir_veredito_sonnet", 'prompt_sistema = """'), {}, false), dossie.PROMPT_VEREDITO);
  const tplV = extrair("emitir_veredito_sonnet", 'payload = f"""');
  const relacionados = Array.from({ length: 12 }, (_, i) => ({ snippet: { title: `Canal relacionado ${i}` } }));
  const classifs: [string, dossie.ClassificacaoCanal][] = [
    ["com auto_classificacao", { tipo_produtor: "produtora_digital", tipo_conteudo_predominante: "esportivo", auto_classificacao: "Canal de esportes" }],
    ["sem auto_classificacao", { tipo_produtor: "marca", tipo_conteudo_predominante: "promocional" }],
  ];
  for (const [nomeR, rel] of [["com rede", relacionados], ["sem rede", []]] as const)
    for (const [nomeC, cl] of classifs) {
      const s = sintomasBase;
      const sn = canal.snippet as Record<string, string>;
      const rede = rel.length
        ? `Canais que este canal recomenda publicamente: ${rel.slice(0, 10).map((c) => c.snippet.title).join(", ")}`
        : "Nenhum canal relacionado declarado publicamente.";
      const esperado = renderizar(tplV, {
        "snippet.get('title', '')": sn.title,
        "snippet.get('description', '')[:2000]": pyCorte(sn.description, 2000),
        "classificacao_haiku['tipo_produtor']": cl.tipo_produtor,
        "classificacao_haiku['tipo_conteudo_predominante']": cl.tipo_conteudo_predominante,
        "classificacao_haiku.get('auto_classificacao', '')": "auto_classificacao" in cl ? pyStr(cl.auto_classificacao) : "",
        "int(stats.get('subscriberCount', 0)):,": pyMilhar(pyInt(canal.statistics.subscriberCount)),
        "int(stats.get('videoCount', 0)):,": pyMilhar(pyInt(canal.statistics.videoCount)),
        "sintomas['frequencia_videos_por_dia']:.2f": pyFixed(s.frequencia_videos_por_dia!, 2),
        "sintomas['duracao_mediana_segundos']/60:.1f": pyFixed(s.duracao_mediana_segundos / 60, 1),
        "f\"{sintomas['taxa_engajamento_mediana']:.2f}%\" if sintomas.get('taxa_engajamento_mediana') is not None else 'indisponível'": `${pyFixed(s.taxa_engajamento_mediana!, 2)}%`,
        "sintomas['pct_titulos_padronizados']:.0f": pyFixed(s.pct_titulos_padronizados, 0),
        "sintomas['link_externo_repetido'] or 'nenhum identificado'": pyStr(s.link_externo_repetido),
        rede_resumo: rede,
        aparicoes_termometro: "7",
      });
      comparar(`Dossiê · payload veredito (${nomeR}, ${nomeC})`, esperado, dossie.montarPayloadVeredito(canal, cl, s, rel as never, 7));
    }
  conferirChamada("emitir_veredito_sonnet", dossie.MODELO_VEREDITO, dossie.MAX_TOKENS_VEREDITO);
}

if (!ok) process.exit(1);
console.log("\n✓ Todos os prompts portados são idênticos ao app.py");
