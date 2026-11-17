import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Destino dos links que chegam por e-mail (modelos do Supabase apontam para
 * {{ .SiteURL }}/api/auth/confirmar?token_hash=...&type=...&idioma=...).
 * Valida o token, grava a sessão em cookie e manda para a conta. No link de
 * "esqueci a senha", a conta abre já no campo de nova senha.
 */

const TIPOS: EmailOtpType[] = ["email", "magiclink", "signup", "recovery", "invite", "email_change"];
const PREFIXO: Record<string, string> = { pt: "", en: "/en", es: "/es" };

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const prefixo = PREFIXO[searchParams.get("idioma") ?? "pt"] ?? "";

  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
  const falhou = NextResponse.redirect(`${origin}${prefixo}/entrar?erro=link`);
  if (!url || !chave || !tokenHash || !tipo || !TIPOS.includes(tipo)) return falhou;

  const destino = `${origin}${prefixo}/conta${tipo === "recovery" ? "?senha=1#senha" : ""}`;
  const resposta = NextResponse.redirect(destino);
  const db = createServerClient(url, chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (novos) => {
        for (const { name, value, options } of novos) resposta.cookies.set(name, value, options);
      },
    },
  });
  const { error } = await db.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
  if (error) {
    console.warn("[auth] link inválido ou expirado:", error.code ?? error.message);
    return falhou;
  }
  return resposta;
}
