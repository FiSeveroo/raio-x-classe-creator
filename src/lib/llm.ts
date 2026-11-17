import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { registrarErro } from "@/lib/erros";
import { parsearJsonLlm } from "@/lib/lupa/prompt";

/**
 * Uma chamada ao Claude, como no app.py: cliente.messages.create(model,
 * max_tokens, system, messages=[user]) e leitura de resposta.content[0].text.
 * Sem temperatura nem thinking explícitos — mesmos padrões do Python.
 */
export async function chamarClaude(p: {
  model: string;
  max_tokens: number;
  system: string;
  user: string;
}): Promise<string> {
  const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resposta = await cliente.messages.create({
    model: p.model,
    max_tokens: p.max_tokens,
    system: p.system,
    messages: [{ role: "user", content: p.user }],
  });
  const primeiro = resposta.content[0];
  return primeiro?.type === "text" ? primeiro.text : "";
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
