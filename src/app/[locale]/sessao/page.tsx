import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { ListaSessao } from "./lista-sessao";

export async function generateMetadata({ params }: PageProps<"/[locale]/sessao">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Sessao" });
  // Página pessoal (do navegador): fora dos buscadores.
  return { title: t("titulo"), robots: { index: false } };
}

export default async function Sessao({ params }: PageProps<"/[locale]/sessao">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Sessao");
  const tm = await getTranslations("Modulos");

  return (
    <Pagina className="max-w-4xl">
      <h1 className="font-display text-[clamp(2rem,8vw,4.5rem)] leading-[0.95]">{t("titulo")}</h1>
      <p className="prosa mt-6 text-lg">{rico(t("texto"))}</p>
      <div className="mt-10">
        <ListaSessao nomes={{ lupa: tm("lupa.nome"), disputa: tm("disputa.nome"), dossie: tm("dossie.nome"), voz: tm("voz.nome") }} />
      </div>
    </Pagina>
  );
}
