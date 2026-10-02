import type { MetadataRoute } from "next";

/*
 * Enquanto o site roda numa URL de teste (antes da virada para
 * raiox.classecreator.com), nada deve ser indexado. Na virada, definir
 * PERMITIR_INDEXACAO=true na Vercel.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.PERMITIR_INDEXACAO !== "true") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://raiox.classecreator.com";
  return {
    // Páginas pessoais e APIs fora dos buscadores.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/sessao", "/en/sessao", "/es/sessao"] },
    host: base,
  };
}
