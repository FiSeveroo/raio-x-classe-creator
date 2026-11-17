import "server-only";
import { chamarClaudeJson } from "@/lib/llm";
import { codigosConteudo, codigosProdutor } from "@/lib/tipologia";
import { ErroLupa, type MetaCanal, type MetaVideo } from "./youtube";
import { montarExemplosDinamicos, montarPayload, montarPromptSistema } from "./prompt";
import { buscarCanalValidado, buscarExemplosAncora } from "./registro";

// Mesmos parâmetros do app.py (conferidos por scripts/verificar-prompt-lupa.mts).
// Modelo mantido de propósito: trocar muda a classificação e a comparabilidade do corpus.
export const MODELO_LUPA = "claude-haiku-4-5";
export const MAX_TOKENS_LUPA = 600;

export type Classificacao = {
  tipo_produtor: string;
  tipo_conteudo: string;
  justificativa: string;
};

/** app.py: classificar_com_claude */
export async function classificarComClaude(video: MetaVideo, canal: MetaCanal): Promise<Classificacao> {
  // 1. Âncora validada: classificação humana do canal vence a IA (nem chama o modelo).
  let exemplosDinamicos = "";
  try {
    const validado = video.canal_id ? await buscarCanalValidado(video.canal_id) : null;
    if (validado) {
      return {
        tipo_produtor: validado.tipo_produtor,
        // No Python: validado.get("tipo_conteudo") or meta_video.get("tipo_conteudo", "outros")
        // — meta_video não tem tipo_conteudo, então o fallback é sempre "outros".
        tipo_conteudo: validado.tipo_conteudo || "outros",
        justificativa: `[ÂNCORA VALIDADA] ${validado.justificativa ?? "None"}`,
      };
    }
    // 2. Few-shot dinâmico com os 15 canais validados mais recentes.
    exemplosDinamicos = montarExemplosDinamicos(await buscarExemplosAncora(15));
  } catch {
    // falha silenciosa — segue para a IA sem exemplos (igual ao Python)
  }

  const resultado = (await chamarClaudeJson({
    model: MODELO_LUPA,
    max_tokens: MAX_TOKENS_LUPA,
    system: montarPromptSistema(exemplosDinamicos),
    user: montarPayload(video, canal),
  })) as Partial<Classificacao>;

  if (!codigosProdutor().includes(String(resultado.tipo_produtor))) {
    throw new ErroLupa("codigo_invalido", `Código de produtor inválido: ${resultado.tipo_produtor}`);
  }
  if (!codigosConteudo().includes(String(resultado.tipo_conteudo))) {
    throw new ErroLupa("codigo_invalido", `Código de conteúdo inválido: ${resultado.tipo_conteudo}`);
  }
  return resultado as Classificacao;
}
