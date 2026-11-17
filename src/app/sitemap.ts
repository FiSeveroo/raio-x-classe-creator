import type { MetadataRoute } from "next";
import { bibliotecaBuscas, bibliotecaComentarios, bibliotecaDossies, bibliotecaVideos } from "@/lib/corpus";

/*
 * Mapa do site para os buscadores (lançamento público, 17/nov/2026): páginas
 * fixas e as análises canônicas da Biblioteca, nas três línguas (PT sem
 * prefixo, /en, /es). Fica fora: conta, projetos, link de leitura, sessão.
 * O robots.txt só aponta para cá no domínio oficial.
 */

export const revalidate = 3600;

const BASE = "https://raiox.classecreator.com";
const FIXAS = ["", "/lupa", "/termometro", "/disputa", "/dossie", "/voz", "/biblioteca", "/sobre", "/privacidade"];

function entrada(caminho: string, data?: string | null): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}${caminho}`,
    lastModified: data ? new Date(data) : undefined,
    alternates: { languages: { "pt-BR": `${BASE}${caminho}`, en: `${BASE}/en${caminho}`, es: `${BASE}/es${caminho}` } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [videos, dossies, buscas, vozes] = await Promise.all([bibliotecaVideos(), bibliotecaDossies(), bibliotecaBuscas(), bibliotecaComentarios()]);
  const lista = <T,>(r: { status: string; dados?: T[] }) => (r.status === "ok" ? (r.dados ?? []) : []);

  return [
    ...FIXAS.map((c) => entrada(c)),
    ...lista(videos).map((v) => entrada(`/biblioteca/video/${v.id}`, v.data_classificacao)),
    ...lista(dossies).map((d) => entrada(`/biblioteca/canal/${d.id}`, d.data_dossie)),
    ...lista(buscas).map((b) => entrada(`/biblioteca/tema/${b.id}`, b.data_busca)),
    ...lista(vozes).map((v) => entrada(`/biblioteca/voz/${v.id}`, v.data_analise)),
  ];
}
