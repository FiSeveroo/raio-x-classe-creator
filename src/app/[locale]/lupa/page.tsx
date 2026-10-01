import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { LIMITE_DIARIO_LUPA, LIMITE_LUPA_POR_SESSAO } from "@/lib/lupa/registro";
import { slotsUsadosLupa } from "./actions";
import { FormularioLupa } from "./formulario-lupa";

export async function generateMetadata({ params }: PageProps<"/[locale]/lupa">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Modulos" });
  return { title: t("lupa.nome"), description: t("lupa.frase") };
}

export default async function Lupa({ params }: PageProps<"/[locale]/lupa">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Lupa");
  const tm = await getTranslations("Modulos");
  const usados = await slotsUsadosLupa();

  return (
    <Pagina>
      <Eyebrow className="mb-6">01 · {tm("lupa.escala")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,10vw,8rem)] leading-[0.9] [overflow-wrap:anywhere]">
        {tm("lupa.nome")}
      </h1>
      <p className="mt-6 font-display text-xl text-cc-green sm:text-2xl">{t("subtitulo")}</p>
      <p className="prosa mt-6 text-lg">{rico(t("intro"))}</p>

      <FormularioLupa
        restantesIniciais={LIMITE_LUPA_POR_SESSAO - usados}
        limiteSessao={LIMITE_LUPA_POR_SESSAO}
        limiteDiario={LIMITE_DIARIO_LUPA}
      />
    </Pagina>
  );
}
