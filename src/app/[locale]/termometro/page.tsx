import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModuloEmMigracao } from "@/components/modulo-em-migracao";

// Provisório: substituído pelo módulo portado na Fase 2.
export async function generateMetadata({ params }: PageProps<"/[locale]/termometro">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Modulos" });
  return { title: t("termometro.nome"), description: t("termometro.frase") };
}

export default async function Page({ params }: PageProps<"/[locale]/termometro">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ModuloEmMigracao chave="termometro" />;
}
