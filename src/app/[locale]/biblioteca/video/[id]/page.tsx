import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Aviso, Pagina } from "@/components/pagina";
import { classificacaoVideoPorId, historicoVersoesVideo } from "@/lib/corpus";
import { nomeConteudo, nomeProdutor } from "@/lib/tipologia";
import { cn } from "@/lib/utils";

export const revalidate = 300;
// IDs do corpus são gerados sob demanda (o layout restringe só o idioma).
export const dynamicParams = true;

type Props = PageProps<"/[locale]/biblioteca/video/[id]">;

async function carregar(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return classificacaoVideoPorId(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const r = await carregar(id);
  if (r.status !== "ok" || !r.dados) return {};
  const v = r.dados;
  const classificacao = `${nomeProdutor(v.tipo_produtor, locale)} × ${nomeConteudo(v.tipo_conteudo, locale)}`;
  const descricao = v.justificativa
    ? `${classificacao} — ${v.justificativa.slice(0, 180)}${v.justificativa.length > 180 ? "…" : ""}`
    : classificacao;

  return {
    title: v.titulo ?? `#${v.id}`,
    description: descricao,
    openGraph: { title: v.titulo ?? `#${v.id}`, description: descricao, type: "article" },
  };
}

export default async function AnaliseVideo({ params }: Props) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  const t = await getTranslations("Biblioteca");
  const tc = await getTranslations("Comum");
  const format = await getFormatter();
  const data = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "—";

  const r = await carregar(id);
  if (r.status === "sem_banco") {
    return (
      <Pagina>
        <Aviso>{tc("semBanco")}</Aviso>
      </Pagina>
    );
  }
  if (r.status === "erro") {
    return (
      <Pagina>
        <Aviso tom="erro">{tc("erroConsulta", { erro: r.mensagem })}</Aviso>
      </Pagina>
    );
  }
  const v = r.dados;
  if (!v) notFound();

  const hist = await historicoVersoesVideo(v.video_id);
  const versoes = hist.status === "ok" ? hist.dados : [];
  const maisRecente = versoes[0];
  const desatualizada = maisRecente && maisRecente.id !== v.id;

  return (
    <Pagina className="max-w-3xl">
      <Link
        href="/biblioteca"
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> {t("titulo")}
      </Link>

      {desatualizada && (
        <div className="mt-6">
          <Aviso>
            v{v.versao_numero ?? 1} →{" "}
            <Link href={`/biblioteca/video/${maisRecente.id}`} className="text-verde underline underline-offset-4">
              v{maisRecente.versao_numero} ({t("atual")})
            </Link>
          </Aviso>
        </div>
      )}

      <article className="mt-8 border-l-2 border-verde pl-5 sm:pl-8">
        <p className="rotulo">
          {t("analiseVideo", { versao: v.versao_numero ?? 1, data: data(v.data_classificacao) })}
        </p>
        <h1 className="mt-4 font-sans text-2xl leading-tight font-semibold tracking-normal normal-case sm:text-3xl">
          {v.titulo}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("canalRotulo")}: <strong className="text-foreground">{v.canal_nome}</strong>
        </p>

        <dl className="mt-6 flex flex-wrap gap-2">
          <div className="rounded bg-superficie-2 px-3 py-2">
            <dt className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              {t("colunas.produtor")}
            </dt>
            <dd className="font-semibold text-verde">{nomeProdutor(v.tipo_produtor, locale)}</dd>
          </div>
          <div className="rounded bg-superficie-2 px-3 py-2">
            <dt className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              {t("colunas.conteudo")}
            </dt>
            <dd className="font-semibold text-roxo-texto">{nomeConteudo(v.tipo_conteudo, locale)}</dd>
          </div>
        </dl>

        <h2 className="mt-8 font-sans text-sm font-semibold tracking-normal normal-case">{t("justificativa")}</h2>
        {/* Justificativa é gerada em PT pelo modelo e fica no idioma original. */}
        <p lang="pt-BR" className="prosa mt-2">
          {v.justificativa ?? "—"}
        </p>

        <a
          href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-verde hover:underline"
        >
          {t("verNoYoutube")} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </article>

      {versoes.length > 1 && (
        <section className="mt-12 border-t border-border pt-8" aria-labelledby="historico">
          <h2 id="historico" className="text-lg font-bold uppercase">
            {t("historicoTitulo", { n: versoes.length })}
          </h2>
          <ol className="mt-4 space-y-2">
            {versoes.map((h) => {
              const atual = h.id === v.id;
              return (
                <li key={h.id}>
                  <Link
                    href={`/biblioteca/video/${h.id}`}
                    aria-current={atual ? "page" : undefined}
                    className={cn(
                      "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded px-3 py-2 text-sm transition-colors",
                      atual ? "bg-superficie-2" : "hover:bg-superficie",
                    )}
                  >
                    <span className="font-mono text-xs">v{h.versao_numero}</span>
                    <span className="font-mono text-xs text-muted-foreground">{data(h.data_classificacao)}</span>
                    <span>
                      <span className="text-verde">{nomeProdutor(h.tipo_produtor, locale)}</span>
                      {" / "}
                      <span className="text-roxo-texto">{nomeConteudo(h.tipo_conteudo, locale)}</span>
                    </span>
                    {h.id === maisRecente?.id && (
                      <span className="rotulo text-[0.6rem] text-verde">{t("atual")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </Pagina>
  );
}
