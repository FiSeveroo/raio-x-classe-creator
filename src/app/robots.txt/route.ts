/*
 * robots.txt por domínio: o Google só indexa o domínio oficial. Qualquer
 * outro endereço (o *.vercel.app de teste, previews, localhost) fica
 * bloqueado — evita cópias duplicadas do site nos buscadores.
 * PERMITIR_INDEXACAO=true força a liberação (ex.: um domínio novo).
 */

const OFICIAIS = ["raiox.classecreator.com"];

export function GET(req: Request) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const liberado = OFICIAIS.includes(host) || process.env.PERMITIR_INDEXACAO === "true";
  const corpo = liberado
    ? [
        "User-Agent: *",
        "Allow: /",
        // Páginas pessoais e APIs fora dos buscadores.
        "Disallow: /api/",
        "Disallow: /sessao",
        "Disallow: /en/sessao",
        "Disallow: /es/sessao",
        "",
        `Host: https://${host}`,
        "",
      ].join("\n")
    : "User-Agent: *\nDisallow: /\n";
  return new Response(corpo, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
