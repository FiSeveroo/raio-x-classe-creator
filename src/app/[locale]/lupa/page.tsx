import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { FormularioAnalise } from "@/components/formulario-analise";
import { Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { humanoVerificado, turnstileSiteKey } from "@/lib/turnstile";
import { LIMITES, slotsUsados } from "@/lib/versionamento";
import { analisarVideo } from "./acoes";

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
  const usados = await slotsUsados("lupa");

  return (
    <Pagina>
      <Eyebrow className="mb-6">01 · {tm("lupa.escala")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,10vw,8rem)] leading-[0.9] [overflow-wrap:anywhere]">
        {tm("lupa.nome")}
      </h1>
      <p className="mt-6 font-display text-xl text-cc-green sm:text-2xl">{t("subtitulo")}</p>
      <p className="prosa mt-6 text-lg">{rico(t("intro"))}</p>

      <FormularioAnalise
        namespace="Lupa"
        acao={analisarVideo}
        destino="/biblioteca/video/"
        restantesIniciais={LIMITES.lupa.sessao - usados}
        limiteSessao={LIMITES.lupa.sessao}
        limiteDiario={LIMITES.lupa.diario}
        siteKeyTurnstile={turnstileSiteKey()}
        verificadoInicial={await humanoVerificado()}
      />
    </Pagina>
  );
}
