import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { FormularioAnalise } from "@/components/formulario-analise";
import { Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { humanoVerificado, turnstileSiteKey } from "@/lib/turnstile";
import { LIMITES, slotsUsados } from "@/lib/versionamento";
import { gerarDossie } from "./acoes";

// O Dossiê faz 3 chamadas ao Claude (uma delas Sonnet): pode levar 1 minuto.
export const maxDuration = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/dossie">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Modulos" });
  return { title: t("dossie.nome"), description: t("dossie.frase") };
}

export default async function Dossie({ params }: PageProps<"/[locale]/dossie">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dossie");
  const tm = await getTranslations("Modulos");
  const usados = await slotsUsados("dossie");

  return (
    <Pagina>
      <Eyebrow className="mb-6">04 · {tm("dossie.escala")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,10vw,8rem)] leading-[0.9] [overflow-wrap:anywhere] hyphens-auto">
        {tm("dossie.nome")}
      </h1>
      <p className="mt-6 font-display text-xl text-cc-green sm:text-2xl">{t("subtitulo")}</p>
      <p className="prosa mt-6 text-lg">{rico(t("intro"))}</p>

      <FormularioAnalise
        namespace="Dossie"
        acao={gerarDossie}
        destino="/biblioteca/canal/"
        tipoEntrada="text"
        restantesIniciais={LIMITES.dossie.sessao - usados}
        limiteSessao={LIMITES.dossie.sessao}
        limiteDiario={LIMITES.dossie.diario}
        siteKeyTurnstile={turnstileSiteKey()}
        verificadoInicial={await humanoVerificado()}
      />
    </Pagina>
  );
}
