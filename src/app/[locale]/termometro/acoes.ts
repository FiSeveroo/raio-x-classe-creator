"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/*
 * Acesso ao painel interno do Termômetro — porte do gate por senha do app.py
 * (SENHA_PAINEL_INTERNO). Como no Streamlit, senha vazia = painel liberado
 * (modo desenvolvimento). A sessão vale até fechar o navegador.
 */

const COOKIE = "raiox_painel";
const hash = (s: string) => createHash("sha256").update(`raiox-painel:${s}`).digest("hex");

/** O painel está liberado para esta sessão? */
export async function painelLiberado(): Promise<boolean> {
  const senha = process.env.SENHA_PAINEL_INTERNO ?? "";
  if (!senha) return true;
  const valor = (await cookies()).get(COOKIE)?.value ?? "";
  const esperado = hash(senha);
  return valor.length === esperado.length && timingSafeEqual(Buffer.from(valor), Buffer.from(esperado));
}

export async function entrarPainel(_estado: { erro: boolean }, dados: FormData): Promise<{ erro: boolean }> {
  const senha = process.env.SENHA_PAINEL_INTERNO ?? "";
  const tentativa = String(dados.get("senha") ?? "");
  const ok = !senha || (tentativa.length === senha.length && timingSafeEqual(Buffer.from(tentativa), Buffer.from(senha)));
  if (!ok) return { erro: true };
  (await cookies()).set(COOKIE, hash(senha), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect(String(dados.get("voltar") ?? "/termometro"));
}

export async function sairPainel(dados: FormData) {
  (await cookies()).delete(COOKIE);
  redirect(String(dados.get("voltar") ?? "/termometro"));
}
