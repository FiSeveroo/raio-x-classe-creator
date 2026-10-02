import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { FormularioAnalise } from "@/components/formulario-analise";
import { Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { SUGESTOES_BUSCA } from "@/lib/disputa/sugestoes";
import { humanoVerificado, turnstileSiteKey } from "@/lib/turnstile";
import { LIMITES, slotsUsados } from "@/lib/versionamento";
import { auditarTema } from "./acoes";

// Até 50 classificações (Haiku) por busca: pode levar 1–2 minutos.
export const maxDuration = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/disputa">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Modulos" });
  return { title: t("disputa.nome"), description: t("disputa.frase") };
}

export default async function Disputa({ params }: PageProps<"/[locale]/disputa">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Disputa");
  const tm = await getTranslations("Modulos");
  const usados = await slotsUsados("disputa");

  return (
    <Pagina>
      <Eyebrow className="mb-6">03 · {tm("disputa.escala")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,10vw,8rem)] leading-[0.9] [overflow-wrap:anywhere] hyphens-auto">
        {tm("disputa.nome")}
      </h1>
      <p className="mt-6 font-display text-xl text-cc-green sm:text-2xl">{t("subtitulo")}</p>
      <p className="prosa mt-6 text-lg">{rico(t("intro"))}</p>

      <FormularioAnalise
        namespace="Disputa"
        acao={auditarTema}
        destino="/biblioteca/tema/"
        tipoEntrada="text"
        restantesIniciais={LIMITES.disputa.sessao - usados}
        limiteSessao={LIMITES.disputa.sessao}
        limiteDiario={LIMITES.disputa.diario}
        siteKeyTurnstile={turnstileSiteKey()}
        verificadoInicial={await humanoVerificado()}
        sugestoes={SUGESTOES_BUSCA.map((g) => ({ grupo: t(`grupos.${g.chave}`), termos: g.termos }))}
      />
    </Pagina>
  );
}
