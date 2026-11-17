import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listarProjetos, projetoAtivoId } from "@/lib/projetos";
import { usuarioAtual } from "@/lib/supabase/conta";
import { NovoProjeto } from "./controles";

export async function generateMetadata({ params }: PageProps<"/[locale]/projetos">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Projetos" });
  return { title: t("titulo"), robots: { index: false } };
}

export default async function Projetos({ params }: PageProps<"/[locale]/projetos">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  if (!(await usuarioAtual())) redirect({ href: "/entrar", locale });
  const t = await getTranslations("Projetos");
  const format = await getFormatter();
  const [projetos, ativo] = await Promise.all([listarProjetos(), projetoAtivoId()]);

  return (
    <Pagina>
      <Eyebrow className="mb-6">{t("eyebrow")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,8vw,5.5rem)] leading-[0.9]">{t("titulo")}</h1>
      <p className="prosa mt-6 max-w-prose text-lg">{rico(t("intro"))}</p>

      {projetos.length > 0 && (
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projetos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projetos/${p.id}`}
                className="flex h-full flex-col rounded-xl border border-cc-line bg-cc-surface p-5 transition-colors hover:border-cc-green"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-display text-xl [overflow-wrap:anywhere]">{p.nome}</span>
                  {p.id === ativo && (
                    <span className="label-caps inline-flex shrink-0 items-center gap-1 text-[0.65rem] text-cc-green">
                      <Star aria-hidden className="size-3 fill-current" /> {t("ativo")}
                    </span>
                  )}
                </span>
                {p.descricao && <span className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.descricao}</span>}
                <span className="mt-auto pt-4 text-xs text-muted-foreground">
                  {t("contagem", { n: p.total })} · {t("atualizado", { data: format.dateTime(new Date(p.atualizado_em), { dateStyle: "medium" }) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12">
        <NovoProjeto />
      </div>
    </Pagina>
  );
}
