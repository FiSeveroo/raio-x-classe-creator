import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { registrarErro } from "@/lib/erros";
import { parsearJsonLlm } from "@/lib/lupa/prompt";
import { ErroPrevisto } from "@/lib/youtube";

/*
 * Modelos (decisão do Filipe em 17/nov/2026): Haiku 4.5 → Haiku 5.5 e
 * Sonnet 4.6 → Sonnet 5.5, com os prompts do app.py inalterados. Os dois
 * pensam antes de responder (raciocínio adaptativo, cobrado como saída); o
 * esforço limita isso: baixo nas classificações do Haiku, médio nas leituras
 * qualitativas do Sonnet. Os max_tokens foram aumentados para caber o
 * raciocínio (o teto não é custo: cobra-se só o que é gerado).
 */
const ESFORCO: Record<string, "low" | "medium"> = {
  "claude-haiku-5-5": "low",
  "claude-sonnet-5-5": "medium",
};

/**
 * Uma chamada ao Claude, como no app.py: messages.create(model, max_tokens,
 * system, messages=[user]). A resposta é o primeiro bloco de TEXTO: os
 * modelos novos podem começar com blocos de raciocínio (thinking).
 */
export async function chamarClaude(p: {
  model: string;
  max_tokens: number;
  system: string;
  user: string;
}): Promise<string> {
  const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const esforco = ESFORCO[p.model];
  const resposta = await cliente.messages.create({
    model: p.model,
    max_tokens: p.max_tokens,
    system: p.system,
    messages: [{ role: "user", content: p.user }],
    ...(esforco && { output_config: { effort: esforco } }),
  });
  if (resposta.stop_reason === "refusal") {
    throw new ErroPrevisto("recusa_ia", `${p.model} recusou a análise (${resposta.stop_details?.category ?? "sem categoria"})`);
  }
  const texto = resposta.content.find((b) => b.type === "text");
  if (!texto && resposta.stop_reason === "max_tokens") {
    throw new ErroPrevisto("resposta_truncada", `${p.model} atingiu max_tokens=${p.max_tokens} antes de responder`);
  }
  return texto?.type === "text" ? texto.text : "";
}

/** A resposta do modelo não pôde ser lida como JSON. */
export class ErroJsonLlm extends Error {}

function lerJson(texto: string): Record<string, unknown> {
  try {
    return parsearJsonLlm(texto);
  } catch (e) {
    throw new ErroJsonLlm(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Chamada que precisa devolver JSON. O modelo às vezes escreve uma aspa sem
 * escape no meio de um texto longo e o JSON quebra; nesse caso, repete a
 * mesma chamada UMA vez (mesmo prompt, mesmo payload). Se falhar de novo,
 * lança o erro de parse da segunda tentativa. Diferença deliberada em relação
 * ao app.py, que desistia na primeira falha.
 */
export async function chamarClaudeJson(p: Parameters<typeof chamarClaude>[0]): Promise<Record<string, unknown>> {
  try {
    return lerJson(await chamarClaude(p));
  } catch (primeiro) {
    if (!(primeiro instanceof ErroJsonLlm)) throw primeiro;
    console.warn(`[llm] JSON malformado (${p.model}), repetindo a chamada: ${primeiro.message}`);
    // Registra a repetição mesmo quando a segunda dá certo: mede a frequência.
    registrarErro({ modulo: "llm", codigo: "json_repetido", mensagem: `${p.model}: ${primeiro.message}` });
    return lerJson(await chamarClaude(p));
  }
}
