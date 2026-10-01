import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Eyebrow, SectionTitle } from "@/components/brand/Brand";
import { Aviso, Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { Button } from "@/components/ui/button";
import { classificacaoVideoPorId, historicoVersoesVideo } from "@/lib/corpus";
import { buscarConteudo, buscarProdutor, nomeConteudo, nomeProdutor } from "@/lib/tipologia";
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

/** metadados_json gravado pela Lupa ({**meta_video, **meta_canal}); null se ilegível. */
function lerMetadados(json: string | null | undefined): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const m = JSON.parse(json);
    return m && typeof m === "object" ? m : null;
  } catch {
    return null;
  }
}

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

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

export default async function AnaliseVideo({ params, searchParams }: Props) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const { nova } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Biblioteca");
  const ta = await getTranslations("Analise");
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

  const meta = lerMetadados(v.metadados_json);
  const isShort = (meta?.is_short ?? v.is_short ?? null) as boolean | null;
  const duracao = numero(meta?.duracao_segundos);
  const views = numero(meta?.visualizacoes);
  const likes = numero(meta?.likes);
  const coments = numero(meta?.comentarios);
  // app.py: (likes + comentários) / visualizações × 100, com 2 casas
  const engajamento =
    views !== null && likes !== null && coments !== null ? (views > 0 ? ((likes + coments) / views) * 100 : 0) : null;

  const metricas: [string, string | null, string?][] = [
    [ta("visualizacoes"), views === null ? null : format.number(views)],
    [ta("inscritos"), numero(meta?.inscritos) === null ? null : format.number(numero(meta?.inscritos)!)],
    [ta("totalVideos"), numero(meta?.total_videos) === null ? null : format.number(numero(meta?.total_videos)!)],
    [
      ta("engajamento"),
      engajamento === null ? null : `${format.number(engajamento, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
      ta("engajamentoAjuda"),
    ],
  ];

  const produtor = buscarProdutor(v.tipo_produtor);
  const conteudo = buscarConteudo(v.tipo_conteudo);

  return (
    <Pagina className="max-w-5xl">
      <Link href="/biblioteca" className="label-caps inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden /> {t("titulo")}
      </Link>

      {nova === "1" && (
        <p role="status" className="mt-6 flex items-center gap-2 rounded-lg border-l-2 border-cc-green bg-cc-surface px-4 py-3 text-sm">
          <CheckCircle2 aria-hidden className="size-4 text-cc-green" /> {ta("nova")}
        </p>
      )}

      {desatualizada && (
        <div className="mt-6">
          <Aviso>
            v{v.versao_numero ?? 1} →{" "}
            <Link href={`/biblioteca/video/${maisRecente.id}`} className="text-cc-green underline underline-offset-4">
              v{maisRecente.versao_numero} ({t("atual")})
            </Link>
          </Aviso>
        </div>
      )}

      {/* Cabeçalho do vídeo */}
      <header className="mt-8">
        <Eyebrow>{t("analiseVideo", { versao: v.versao_numero ?? 1, data: data(v.data_classificacao) })}</Eyebrow>
        <h1 className="mt-4 text-2xl leading-tight font-semibold sm:text-4xl">{v.titulo}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
          <span>
            {t("canalRotulo")}: <strong className="text-foreground">{v.canal_nome}</strong>
          </span>
          {isShort === true && duracao !== null && (
            <span className="label-caps rounded-md bg-cc-purple px-2 py-1 text-white">{ta("short", { seg: duracao })}</span>
          )}
          {isShort === false && duracao !== null && (
            <span className="label-caps rounded-md bg-cc-green px-2 py-1 text-primary-foreground">
              {ta("longo", { min: Math.floor(duracao / 60), seg: duracao % 60 })}
            </span>
          )}
        </div>
      </header>

      {/* Métricas (só quando a análise guardou os metadados) */}
      {meta && (
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-cc-line bg-cc-line lg:grid-cols-4">
          {metricas.map(([rotulo, valor, ajuda]) => (
            <div key={rotulo} className="flex flex-col-reverse justify-end gap-2 bg-cc-surface px-4 py-5" title={ajuda}>
              <dt className="label-caps text-muted-foreground">{rotulo}</dt>
              <dd className="font-display text-lg tabular-nums break-all sm:text-xl lg:text-2xl">
                {valor ?? <span className="font-sans text-sm font-normal normal-case text-muted-foreground">{tc("semDados")}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Análise tipológica */}
      <section className="mt-14" aria-labelledby="tipologica">
        <SectionTitle as="h2">
          <span id="tipologica">{ta("tipologica")}</span>
        </SectionTitle>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border-l-4 border-cc-green bg-cc-surface p-6">
            <Eyebrow>{ta("eixoA")}</Eyebrow>
            <p className="mt-3 font-display text-3xl leading-none text-cc-green">{nomeProdutor(v.tipo_produtor, locale)}</p>
            {produtor && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{rico(produtor.definicao[locale])}</p>}
          </div>
          <div className="rounded-2xl border-l-4 border-cc-purple bg-cc-surface p-6">
            <Eyebrow>{ta("eixoB")}</Eyebrow>
            <p className="mt-3 font-display text-3xl leading-none text-cc-purple-text">{nomeConteudo(v.tipo_conteudo, locale)}</p>
            {conteudo && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{rico(conteudo.definicao[locale])}</p>}
          </div>
        </div>

        <h3 className="mt-10 font-display text-xl text-cc-purple-text">{ta("comoChegamos")}</h3>
        {/* Justificativa é gerada em PT pelo modelo e fica no idioma original. */}
        <p lang="pt-BR" className="mt-3 rounded-xl border-l-4 border-foreground bg-cc-surface p-6 leading-relaxed">
          {v.justificativa ?? "—"}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}`} target="_blank" rel="noopener noreferrer">
              {t("verNoYoutube")} <ExternalLink aria-hidden />
            </a>
          </Button>
          <Button asChild>
            <Link href="/lupa">{ta("novaAnaliseLupa")}</Link>
          </Button>
        </div>

        {meta && (
          <details className="mt-8 rounded-xl border border-cc-line bg-cc-surface">
            <summary className="label-caps cursor-pointer px-5 py-4 text-muted-foreground hover:text-foreground">
              {ta("metadados")}
            </summary>
            <pre className="max-h-96 overflow-auto border-t border-cc-line px-5 py-4 text-xs leading-relaxed whitespace-pre-wrap break-words">
              {JSON.stringify(meta, null, 2)}
            </pre>
          </details>
        )}
      </section>

      {versoes.length > 1 && (
        <section className="mt-14 border-t border-cc-line pt-8" aria-labelledby="historico">
          <h2 id="historico" className="font-display text-2xl text-cc-green">
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
                      "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm transition-colors",
                      atual ? "bg-cc-surface-2" : "hover:bg-cc-surface",
                    )}
                  >
                    <span className="text-xs">v{h.versao_numero}</span>
                    <span className="text-xs text-muted-foreground">{data(h.data_classificacao)}</span>
                    <span>
                      <span className="text-cc-green">{nomeProdutor(h.tipo_produtor, locale)}</span>
                      {" / "}
                      <span className="text-cc-purple-text">{nomeConteudo(h.tipo_conteudo, locale)}</span>
                    </span>
                    {h.id === maisRecente?.id && <span className="label-caps text-cc-green">{t("atual")}</span>}
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
