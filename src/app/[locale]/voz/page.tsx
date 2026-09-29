import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModuloEmMigracao } from "@/components/modulo-em-migracao";

// Provisório: substituído pelo módulo portado na Fase 2.
export async function generateMetadata({ params }: PageProps<"/[locale]/voz">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Modulos" });
  return { title: t("voz.nome"), description: t("voz.frase") };
}

export default async function Page({ params }: PageProps<"/[locale]/voz">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ModuloEmMigracao chave="voz" />;
}
