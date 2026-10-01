/*
 * Prompt da Lupa — porte LITERAL de classificar_com_claude (app.py).
 *
 * Este arquivo não pode depender de Next.js nem de aliases "@/": o script
 * scripts/verificar-prompt-lupa.mts o importa direto e compara a saída,
 * caractere por caractere, com o template f-string extraído do app.py.
 * Qualquer mudança aqui precisa espelhar o app.py (e vice-versa).
 */
import { codigosConteudo, codigosProdutor, tipologiaParaPrompt } from "../tipologia.ts";

/** Equivalente a f"{valor}" do Python: None vira "None". */
const py = (v: unknown) => (v === null || v === undefined ? "None" : String(v));

/** Equivalente a f"{n:,}" do Python (separador de milhar com vírgula). */
const milhar = (n: number) =>
  Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Equivalente a s[:n] do Python (corta por caractere Unicode, não por unidade UTF-16). */
const corte = (s: string, n: number) => Array.from(s).slice(0, n).join("");

export type ExemploAncora = {
  canal_nome: string | null;
  tipo_produtor: string | null;
  tipo_conteudo?: string | null;
  justificativa: string | null;
};

/**
 * Bloco "EXEMPLOS VALIDADOS PELO PESQUISADOR". Retorna "" quando não há
 * exemplos — e também quando algum exemplo tem justificativa nula: no Python,
 * `None[:80]` lança TypeError, o try externo engole o erro e o prompt segue
 * sem exemplos. Comportamento replicado de propósito (ver REVISAO da Lupa).
 */
export function montarExemplosDinamicos(exemplos: ExemploAncora[]): string {
  if (exemplos.length === 0) return "";
  if (exemplos.some((ex) => ex.justificativa === null || ex.justificativa === undefined)) return "";
  const linhas = exemplos.map((ex) => {
    const just = corte(ex.justificativa as string, 80);
    return `- ${py(ex.canal_nome)} → ${py(ex.tipo_produtor)}${just ? ` [${just}]` : ""}`;
  });
  return "\n\nEXEMPLOS VALIDADOS PELO PESQUISADOR (aprendizado acumulado):\n" + linhas.join("\n");
}

export function montarPromptSistema(exemplosDinamicos: string): string {
  return `Você é um pesquisador especialista em Estudos de Plataforma, trabalhando para o Observatório Classe Creator. Sua tarefa é classificar artefatos do YouTube usando uma TIPOLOGIA DUPLA específica, ancorada na pesquisa acadêmica de Filipe Severo (PUCRS/FAMECOS, 2026).

Esta tipologia NÃO usa as categorias comerciais do YouTube. Ela busca devolver a materialidade do trabalho ao artefato audiovisual e revelar a estrutura social de produção por trás do conteúdo.

==========
${tipologiaParaPrompt()}
==========

REGRAS:
1. Você DEVE escolher exatamente UMA categoria do Eixo A e UMA do Eixo B.
2. As categorias são MUTUAMENTE EXCLUSIVAS.
3. Use "outros" SOMENTE se nenhuma outra categoria fizer sentido.
4. A justificativa deve ser SOCIOLÓGICA, não descritiva.
5. Considere SEMPRE o canal como pista primária do Eixo A, e o conteúdo como pista do Eixo B.
6. Atenção a "vlogs falsos" e estéticas de autenticidade roteirizada (Cunningham & Craig, 2017).

TESTE DECISIVO — Produtora vs. YouTuber:
"Se essa pessoa saísse do canal, o canal continuaria existindo como marca?"
- SIM → produtora_digital (ex: Ei Nerd, Flow, Desimpedidos, CazéTV, Canal GOAT, Manual do Mundo)
- NÃO → youtuber_profissional (ex: Whindersson, Felipe Neto, Casimiro, Gaules, Virgínia)

EXEMPLOS VALIDADOS (use como calibração):
- Ei Nerd → produtora_digital [marca com apresentadores rotativos, múltiplos canais, empresa]
- Gaules → produtora_digital [ecossistema com múltiplos canais, empresa estruturada]
- Flow Games → produtora_digital [sub-canal do ecossistema Flow]
- Canal GOAT → produtora_digital [produtora nativa de esportes]
- MrBeast → produtora_digital [empresa global, 100+ funcionários]
- Enaldinho → produtora_digital [opera múltiplos canais como empresa]
- Mendrake → youtuber_profissional [persona individual]
- Tonigon → youtuber_profissional [criador individual]
- rezendeevil → youtuber_profissional [persona individual de games]
- Flamengo TV → marca [canal oficial do clube]
- CONMEBOL → instituicao [entidade reguladora]
- VALORANT Esports BR → marca [Riot Games divulgando o jogo]
- Kings League → produtora_digital [campeonato existe para gerar conteúdo]

FORMATO: APENAS JSON válido, sem markdown:
{
  "tipo_produtor": "<código exato do Eixo A>",
  "tipo_conteudo": "<código exato do Eixo B>",
  "justificativa": "<2 a 4 frases analíticas>"
}

CÓDIGOS Eixo A: ${codigosProdutor().join(", ")}
CÓDIGOS Eixo B: ${codigosConteudo().join(", ")}
${exemplosDinamicos}`;
}

export type DadosPayload = {
  titulo: string;
  canal_nome: string;
  visualizacoes: number;
  tags: string[];
  descricao: string;
};

/** Canal: {} quando não encontrado — como o dict vazio do Python. */
export type CanalPayload = {
  canal_descricao?: string;
  inscritos?: number;
  total_videos?: number;
};

export function montarPayload(video: DadosPayload, canal: CanalPayload): string {
  const tags = video.tags.length ? video.tags.slice(0, 20).join(", ") : "(sem tags)";
  const descricaoCanal = "canal_descricao" in canal ? (canal.canal_descricao ?? "") : "(sem descrição)";
  return `DADOS DO VÍDEO:
- Título: ${video.titulo}
- Canal: ${video.canal_nome}
- Inscritos: ${milhar(canal.inscritos ?? 0)}
- Total de vídeos do canal: ${milhar(canal.total_videos ?? 0)}
- Visualizações: ${milhar(video.visualizacoes)}
- Tags: ${tags}

DESCRIÇÃO DO CANAL:
${corte(descricaoCanal, 1500)}

DESCRIÇÃO DO VÍDEO:
${corte(video.descricao, 2000)}
`;
}

/**
 * app.py: parsear_json_llm. Remove cercas de markdown, tenta parse direto e,
 * se falhar, decodifica o PRIMEIRO objeto JSON a partir do primeiro "{"
 * (equivalente ao json.JSONDecoder().raw_decode).
 */
export function parsearJsonLlm(textoBruto: string): Record<string, unknown> {
  if (!textoBruto) throw new Error("Resposta vazia da LLM");
  let texto = textoBruto.trim();
  texto = texto.replace(/^```(?:json)?\s*/, "");
  texto = texto.replace(/\s*```\s*$/, "");
  texto = texto.trim();

  try {
    return JSON.parse(texto);
  } catch {
    // segue para o fallback
  }

  const inicio = texto.indexOf("{");
  if (inicio === -1) throw new Error("Nenhum objeto JSON encontrado na resposta");

  // Acha o fim do primeiro objeto balanceado, respeitando strings e escapes.
  let profundidade = 0;
  let emString = false;
  let escape = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (emString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') emString = true;
    else if (c === "{") profundidade++;
    else if (c === "}" && --profundidade === 0) {
      return JSON.parse(texto.slice(inicio, i + 1));
    }
  }
  throw new Error("JSON incompleto na resposta");
}
