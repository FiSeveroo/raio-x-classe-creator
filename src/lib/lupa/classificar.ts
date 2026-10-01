import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { codigosConteudo, codigosProdutor } from "@/lib/tipologia";
import { ErroLupa, type MetaCanal, type MetaVideo } from "./youtube";
import { montarExemplosDinamicos, montarPayload, montarPromptSistema, parsearJsonLlm } from "./prompt";
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

  const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resposta = await cliente.messages.create({
    model: MODELO_LUPA,
    max_tokens: MAX_TOKENS_LUPA,
    system: montarPromptSistema(exemplosDinamicos),
    messages: [{ role: "user", content: montarPayload(video, canal) }],
  });

  // Python: resposta.content[0].text
  const primeiro = resposta.content[0];
  const texto = primeiro?.type === "text" ? primeiro.text : "";
  const resultado = parsearJsonLlm(texto) as Partial<Classificacao>;

  if (!codigosProdutor().includes(String(resultado.tipo_produtor))) {
    throw new ErroLupa("codigo_invalido", `Código de produtor inválido: ${resultado.tipo_produtor}`);
  }
  if (!codigosConteudo().includes(String(resultado.tipo_conteudo))) {
    throw new ErroLupa("codigo_invalido", `Código de conteúdo inválido: ${resultado.tipo_conteudo}`);
  }
  return resultado as Classificacao;
}
