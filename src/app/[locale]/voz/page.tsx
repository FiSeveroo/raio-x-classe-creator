import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { FormularioAnalise } from "@/components/formulario-analise";
import { Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { LIMITES, slotsUsados } from "@/lib/versionamento";
import { analisarComentarios } from "./acoes";

// Uma chamada Sonnet com 100 comentários e até 8.000 tokens de saída: 1–2 minutos.
export const maxDuration = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/voz">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Modulos" });
  return { title: t("voz.nome"), description: t("voz.frase") };
}

export default async function Voz({ params }: PageProps<"/[locale]/voz">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Voz");
  const tm = await getTranslations("Modulos");
  const usados = await slotsUsados("voz");
  const etica = t.raw("etica") as string[];

  return (
    <Pagina>
      <Eyebrow className="mb-6">05 · {tm("voz.escala")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,10vw,8rem)] leading-[0.9] [overflow-wrap:anywhere] hyphens-auto">
        {tm("voz.nome")}
      </h1>
      <p className="mt-6 font-display text-xl text-cc-green sm:text-2xl">{t("subtitulo")}</p>
      <p className="prosa mt-6 text-lg">{rico(t("intro"))}</p>

      {/* Notas éticas: visíveis de saída (no Streamlit ficavam num expansor fechado). */}
      <aside className="mt-10 max-w-3xl rounded-xl border-l-4 border-cc-orange bg-cc-surface p-5 sm:p-6" aria-labelledby="etica">
        <h2 id="etica" className="label-caps text-cc-orange">{t("eticaTitulo")}</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          {etica.map((p, i) => (
            <p key={i}>{rico(p)}</p>
          ))}
        </div>
      </aside>

      <FormularioAnalise
        namespace="Voz"
        acao={analisarComentarios}
        destino="/biblioteca/voz/"
        restantesIniciais={LIMITES.voz.sessao - usados}
        limiteSessao={LIMITES.voz.sessao}
        limiteDiario={LIMITES.voz.diario}
      />
    </Pagina>
  );
}
