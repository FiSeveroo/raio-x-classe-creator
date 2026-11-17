import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// URLs do Streamlit usavam ?m=<código> na raiz. Links já compartilhados
// continuam funcionando depois da virada de domínio.
const MODULOS_LEGADOS: Record<string, string> = {
  home: "/",
  lupa: "/lupa",
  term: "/termometro",
  disp: "/disputa",
  doss: "/dossie",
  voz: "/voz",
  bib: "/biblioteca",
  sobre: "/sobre",
};

/**
 * Renova a sessão de quem tem conta (cookies "sb-*") e grava os cookies novos
 * na resposta. Sem cookie de sessão, não faz nada: visitante sem conta não
 * gera nenhuma chamada extra.
 */
async function renovarSessao(request: NextRequest, resposta: NextResponse): Promise<NextResponse> {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return resposta;
  const db = createServerClient(url, chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (novos) => {
        for (const { name, value, options } of novos) resposta.cookies.set(name, value, options);
      },
    },
  });
  await db.auth.getUser();
  return resposta;
}

export default async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const modulo = searchParams.get("m");

  if (pathname === "/" && modulo !== null) {
    const destino = request.nextUrl.clone();
    destino.pathname = MODULOS_LEGADOS[modulo] ?? "/";
    destino.search = "";
    return NextResponse.redirect(destino, 308);
  }

  return renovarSessao(request, intl(request));
}

export const config = {
  // Tudo, menos API, arquivos internos do Next e arquivos estáticos (com ponto).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
