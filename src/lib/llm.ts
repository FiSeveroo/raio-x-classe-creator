import "server-only";
import Anthropic from "@anthropic-ai/sdk";

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
