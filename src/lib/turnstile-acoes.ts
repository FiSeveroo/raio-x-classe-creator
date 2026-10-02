"use server";

import { registrarVerificacao } from "./turnstile";

/** Recebe o token do widget Turnstile; true se validado (cookie de 24 h gravado). */
export async function confirmarHumano(token: string): Promise<boolean> {
  return registrarVerificacao(String(token ?? "").slice(0, 2048));
}
