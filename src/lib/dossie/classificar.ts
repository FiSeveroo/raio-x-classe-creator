import "server-only";
import { chamarClaude } from "@/lib/llm";
import { buscarCanalValidado, buscarExemplosAncora } from "@/lib/lupa/registro";
import { parsearJsonLlm } from "@/lib/lupa/prompt";
import { codigosConteudo, codigosProdutor } from "@/lib/tipologia";
import { ErroPrevisto, type ItemVideoApi } from "@/lib/youtube";
import type { CanalRelacionado } from "./canal";
import {
  MAX_TOKENS_CANAL,
  MAX_TOKENS_LOTE_B,
  MAX_TOKENS_VEREDITO,
  MODELO_CANAL,
  MODELO_LOTE_B,
  MODELO_VEREDITO,
  montarExemplosCanal,
  montarPayloadCanal,
  montarPayloadLoteB,
  montarPayloadVeredito,
  montarPromptCanal,
  montarPromptLoteB,
  PROMPT_VEREDITO,
  type ClassificacaoCanal,
} from "./prompts";
import type { CanalApi, Sintomas } from "./sintomas";

/** app.py: classificar_canal_haiku */
export async function classificarCanalHaiku(
  canal: CanalApi,
  videos: ItemVideoApi[],
  sintomas: Sintomas,
): Promise<ClassificacaoCanal> {
  // Âncora validada: classificação humana do canal vence a IA.
  let exemplos = "";
  try {
    const validado = canal.id ? await buscarCanalValidado(canal.id) : null;
    if (validado) {
      return {
        tipo_produtor: validado.tipo_produtor,
        tipo_conteudo_predominante: validado.tipo_conteudo || "outros",
        justificativa_curta: `[ÂNCORA VALIDADA] ${validado.justificativa ?? "None"}`,
        auto_classificacao: "",
      };
    }
    exemplos = montarExemplosCanal(await buscarExemplosAncora(15));
  } catch {
    // falha silenciosa, como no Python
  }

  // No Python, frequência None quebra o f-string (TypeError) e o Dossiê falha.
  if (sintomas.frequencia_videos_por_dia === null) {
    throw new ErroPrevisto(
      "dados_insuficientes",
      "Não há vídeos suficientes com data para calcular a frequência de postagem.",
    );
  }

  const texto = await chamarClaude({
    model: MODELO_CANAL,
    max_tokens: MAX_TOKENS_CANAL,
    system: montarPromptCanal(exemplos),
    user: montarPayloadCanal(canal, videos, sintomas),
  });
  const r = parsearJsonLlm(texto) as unknown as ClassificacaoCanal;
  if (!codigosProdutor().includes(String(r.tipo_produtor))) {
    throw new ErroPrevisto("codigo_invalido", `Código de produtor inválido: ${r.tipo_produtor}`);
  }
  if (!codigosConteudo().includes(String(r.tipo_conteudo_predominante))) {
    throw new ErroPrevisto("codigo_invalido", `Código de conteúdo inválido: ${r.tipo_conteudo_predominante}`);
  }
  return r;
}

export type ClassificacaoVideoLote = { posicao: number; titulo: string; tipo_conteudo: string };

/** app.py: classificar_lote_eixo_b — todos os vídeos numa única chamada. */
export async function classificarLoteEixoB(videos: ItemVideoApi[]): Promise<ClassificacaoVideoLote[]> {
  if (!videos.length) return [];
  const texto = await chamarClaude({
    model: MODELO_LOTE_B,
    max_tokens: MAX_TOKENS_LOTE_B,
    system: montarPromptLoteB(),
    user: montarPayloadLoteB(videos),
  });
  const r = parsearJsonLlm(texto) as { classificacoes?: { posicao?: unknown; tipo_conteudo?: unknown }[] };

  // Posição → código validado ("outros" se inválido). Como no Python, só casa
  // posição numérica (a chave "1" em texto não casa com o inteiro 1).
  const mapa = new Map<number, string>();
  for (const item of r.classificacoes ?? []) {
    const cod = typeof item.tipo_conteudo === "string" ? item.tipo_conteudo : "outros";
    if (typeof item.posicao === "number") mapa.set(item.posicao, codigosConteudo().includes(cod) ? cod : "outros");
  }
  return videos.map((v, i) => ({
    posicao: i + 1,
    titulo: Array.from(v.snippet?.title ?? "").slice(0, 200).join(""),
    tipo_conteudo: mapa.get(i + 1) ?? "outros",
  }));
}

/** app.py: emitir_veredito_sonnet — leitura final em prosa (.strip()). */
export async function emitirVereditoSonnet(
  canal: CanalApi,
  classif: ClassificacaoCanal,
  sintomas: Sintomas,
  relacionados: CanalRelacionado[],
  aparicoesTermometro: number,
): Promise<string> {
  const texto = await chamarClaude({
    model: MODELO_VEREDITO,
    max_tokens: MAX_TOKENS_VEREDITO,
    system: PROMPT_VEREDITO,
    user: montarPayloadVeredito(canal, classif, sintomas, relacionados, aparicoesTermometro),
  });
  return texto.trim();
}
