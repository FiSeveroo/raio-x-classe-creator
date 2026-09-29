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

export default function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const modulo = searchParams.get("m");

  if (pathname === "/" && modulo !== null) {
    const destino = request.nextUrl.clone();
    destino.pathname = MODULOS_LEGADOS[modulo] ?? "/";
    destino.search = "";
    return NextResponse.redirect(destino, 308);
  }

  return intl(request);
}

export const config = {
  // Tudo, menos API, arquivos internos do Next e arquivos estáticos (com ponto).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
