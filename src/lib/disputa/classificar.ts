import "server-only";
import { chamarClaude } from "@/lib/llm";
import { buscarCanalValidado } from "@/lib/lupa/registro";
import { parsearJsonLlm } from "@/lib/lupa/prompt";
import { codigosConteudo, codigosProdutor } from "@/lib/tipologia";
import { MAX_TOKENS_ITEM, MODELO_ITEM, montarPayloadItem, montarPromptItem, type DadosExtras, type ItemBusca } from "./prompts";

export type ClassificacaoItem = { tipo_produtor: string; tipo_conteudo: string; justificativa: string };

/**
 * app.py: classificar_resultado_busca. O bloco de exemplos é montado uma vez
 * por busca (no Python era refeito a cada item, com o mesmo resultado).
 */
export async function classificarItem(item: ItemBusca, extras: DadosExtras, exemplos: string): Promise<ClassificacaoItem> {
  // Âncora validada: a classificação humana do canal vence a IA.
  const canalId = item.snippet.channelId ?? "";
  if (canalId) {
    const validado = await buscarCanalValidado(canalId).catch(() => null);
    if (validado) {
      return {
        tipo_produtor: validado.tipo_produtor,
        tipo_conteudo: validado.tipo_conteudo || "outros",
        // .get('justificativa', '') com a coluna presente e nula → "None", como no Python
        justificativa: `[ÂNCORA VALIDADA] ${validado.justificativa ?? "None"}`,
      };
    }
  }

  const texto = await chamarClaude({
    model: MODELO_ITEM,
    max_tokens: MAX_TOKENS_ITEM,
    system: montarPromptItem(exemplos),
    user: montarPayloadItem(item, extras),
  });
  const r = parsearJsonLlm(texto) as unknown as ClassificacaoItem;
  if (!codigosProdutor().includes(String(r.tipo_produtor))) throw new Error(`Código de produtor inválido: ${r.tipo_produtor}`);
  if (!codigosConteudo().includes(String(r.tipo_conteudo))) throw new Error(`Código de conteúdo inválido: ${r.tipo_conteudo}`);
  return r;
}

/** Executa `fn` sobre todos os itens com no máximo `n` em paralelo, preservando a ordem. */
export async function emParalelo<T, R>(itens: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const saida = new Array<R>(itens.length);
  let proximo = 0;
  const trabalhar = async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhar));
  return saida;
}
