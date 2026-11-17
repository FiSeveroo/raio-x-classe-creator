import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow, SectionTitle } from "@/components/brand/Brand";
import { Pagina } from "@/components/pagina";
import { Paragrafos } from "@/components/rico";
import type { Locale } from "@/i18n/routing";

/*
 * Política de privacidade (decisões do Filipe em 17/nov/2026): responsável é
 * Filipe Severo, pessoa física; contato pelo Gmail dele. Textos em
 * messages/*.json ("PaginaPrivacidade").
 */

const SECOES = ["semConta", "comConta", "naoFazemos", "onde", "direitos"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/privacidade">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PaginaPrivacidade" });
  return { title: t("titulo"), description: t("descricao") };
}

export default async function Privacidade({ params }: PageProps<"/[locale]/privacidade">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("PaginaPrivacidade");

  return (
    <Pagina>
      <Eyebrow className="mb-6">{t("eyebrow")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,8vw,5.5rem)] leading-[0.9]">{t("titulo")}</h1>
      <Paragrafos textos={t.raw("intro") as string[]} className="prosa mt-8 max-w-prose text-lg" />
      {SECOES.map((s) => (
        <section key={s} className="mt-14 max-w-prose" aria-labelledby={`priv-${s}`}>
          <SectionTitle tone="secondary">
            <span id={`priv-${s}`}>{t(`${s}.titulo`)}</span>
          </SectionTitle>
          <Paragrafos textos={t.raw(`${s}.textos`) as string[]} className="prosa" />
        </section>
      ))}
      <p className="mt-14 text-sm text-muted-foreground">{t("atualizado")}</p>
    </Pagina>
  );
}
