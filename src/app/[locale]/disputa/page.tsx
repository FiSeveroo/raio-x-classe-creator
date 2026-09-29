import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ModuloEmMigracao } from "@/components/modulo-em-migracao";

// Provisório: substituído pelo módulo portado na Fase 2.
export async function generateMetadata({ params }: PageProps<"/[locale]/disputa">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Modulos" });
  return { title: t("disputa.nome"), description: t("disputa.frase") };
}

export default async function Page({ params }: PageProps<"/[locale]/disputa">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ModuloEmMigracao chave="disputa" />;
}
