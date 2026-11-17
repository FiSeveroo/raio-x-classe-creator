import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { Pagina } from "@/components/pagina";
import type { Locale } from "@/i18n/routing";
import { projetoPorToken } from "@/lib/projetos";
import { PainelProjeto } from "../../projetos/painel-projeto";

/*
 * Link de leitura de um projeto (sem login). Mostra análises, gráficos e
 * notas; nunca mostra quem é o dono. Fora do Google (noindex).
 */

export const maxDuration = 60;

export async function generateMetadata({ params }: PageProps<"/[locale]/p/[token]">): Promise<Metadata> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "Projetos" });
  const dados = await projetoPorToken(token);
  return { title: dados ? dados.projeto.nome : t("titulo"), robots: { index: false, follow: false } };
}

export default async function ProjetoLeitura({ params }: PageProps<"/[locale]/p/[token]">) {
  const { locale, token } = (await params) as { locale: Locale; token: string };
  setRequestLocale(locale);
  const dados = await projetoPorToken(token);
  if (!dados) notFound();
  const t = await getTranslations("Projetos");
  const { projeto, itens } = dados;

  return (
    <Pagina>
      <Eyebrow className="mb-6">{t("leituraEyebrow")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,7vw,5rem)] leading-[0.95] [overflow-wrap:anywhere]">{projeto.nome}</h1>
      {projeto.descricao && <p className="prosa mt-5 max-w-prose text-lg whitespace-pre-line">{projeto.descricao}</p>}
      <PainelProjeto projeto={projeto} itens={itens} locale={locale} editavel={false} />
    </Pagina>
  );
}
