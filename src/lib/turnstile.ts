import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/*
 * Cloudflare Turnstile — porte de verificar_token_turnstile / exigir_recaptcha
 * (app.py). Modo "managed": invisível para quase todos, desafio só se o
 * tráfego parecer suspeito.
 *
 * Validação no servidor (siteverify). Depois de validado, um cookie assinado
 * (HMAC com a chave secreta) vale por 24 h — o mesmo TTL do Streamlit, que
 * guardava a validação no localStorage. O cookie só contém a validade: nenhum
 * dado pessoal. Sem as duas chaves configuradas, o portão fica desligado
 * (modo desenvolvimento), como no Python.
 */

export const TURNSTILE_TTL_HORAS = 24;
const COOKIE = "raiox_verificado";

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY : null;
}

const assinar = (expira: string) => createHmac("sha256", process.env.TURNSTILE_SECRET_KEY!).update(`raiox:${expira}`).digest("hex");

/** True se o portão está desligado ou se o cookie de verificação é válido. */
export async function humanoVerificado(): Promise<boolean> {
  if (!turnstileSiteKey()) return true;
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return false;
  const [expira, assinatura] = valor.split(".");
  if (!expira || !assinatura || Number(expira) < Date.now()) return false;
  const esperada = Buffer.from(assinar(expira));
  const recebida = Buffer.from(assinatura);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

/** siteverify da Cloudflare. Falha de rede = não verificado (como no Python). */
async function validarToken(token: string): Promise<boolean> {
  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    return ((await resp.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

/** Valida o token do widget e grava o cookie de 24 h. Só em Server Action. */
export async function registrarVerificacao(token: string): Promise<boolean> {
  if (!turnstileSiteKey()) return true;
  if (!token || !(await validarToken(token))) return false;
  const expira = String(Date.now() + TURNSTILE_TTL_HORAS * 3_600_000);
  (await cookies()).set(COOKIE, `${expira}.${assinar(expira)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TURNSTILE_TTL_HORAS * 3600,
  });
  return true;
}
