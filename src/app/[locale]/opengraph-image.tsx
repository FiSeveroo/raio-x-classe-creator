import { getTranslations } from "next-intl/server";
import { cardOg, TAMANHO_OG } from "@/lib/og";

export const size = TAMANHO_OG;
export const contentType = "image/png";
export const alt = "Raio-X da Classe Creator";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return cardOg({
    rotulo: t("heroRotulo"),
    titulo: `${t("heroTitulo1")} ${t("heroTitulo2")}`,
    // Primeira frase do texto de abertura da Home.
    subtitulo: t("heroTexto").split(". ")[0],
  });
}
