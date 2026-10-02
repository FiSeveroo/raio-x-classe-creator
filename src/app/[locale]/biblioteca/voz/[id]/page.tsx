import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Eyebrow, SectionTitle } from "@/components/brand/Brand";
import { Barras } from "@/components/barras";
import { Aviso, Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { Button } from "@/components/ui/button";
import { BotaoSessao } from "@/components/sessao/botao-sessao";
import { comentariosPorId, dossieCanonicoDoCanal, historicoVersoesComentarios } from "@/lib/corpus";
import { faixaIpp, MIN_CORPUS_PARA_PERCENTIS } from "@/lib/voz/analise";
import { DIMENSOES_VOZ } from "@/lib/voz/prompts";
import { buscarDistribuicaoIpps } from "@/lib/voz/registro";
import { cn } from "@/lib/utils";
import { Comentarios, type ComentarioClassificado } from "./comentarios";

export const revalidate = 300;
export const dynamicParams = true;

type Props = PageProps<"/[locale]/biblioteca/voz/[id]">;

async function carregar(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return comentariosPorId(id);
}

function json<T>(s: string | null | undefined, padrao: T): T {
  if (!s) return padrao;
  try {
    return JSON.parse(s) as T;
  } catch {
    return padrao;
  }
}

/** Prosa do modelo: parágrafos separados por linha em branco. */
function Prosa({ texto }: { texto: string }) {
  return (
    <>
      {texto
        .split(/\n\s*\n/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p.trim()}</p>
        ))}
    </>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const r = await carregar(id);
  if (r.status !== "ok" || !r.dados) return {};
  const tm = await getTranslations({ locale, namespace: "Modulos" });
  const titulo = `${r.dados.titulo_video ?? r.dados.video_id} · ${tm("voz.nome")}`;
  return { title: titulo, description: tm("voz.frase"), openGraph: { title: titulo, description: tm("voz.frase") } };
}

export default async function VozDaBase({ params, searchParams }: Props) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const { nova } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("VozResultado");
  const tv = await getTranslations("Voz");
  const tb = await getTranslations("Biblioteca");
  const tc = await getTranslations("Comum");
  const format = await getFormatter();
  const data = (iso: string | null | undefined) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "—");
  const dec = (n: number, casas: number) => format.number(n, { minimumFractionDigits: casas, maximumFractionDigits: casas });

  const r = await carregar(id);
  if (r.status === "sem_banco") return <Pagina><Aviso>{tc("semBanco")}</Aviso></Pagina>;
  if (r.status === "erro") return <Pagina><Aviso tom="erro">{tc("erroConsulta", { erro: r.mensagem })}</Aviso></Pagina>;
  const a = r.dados;
  if (!a) notFound();

  const [hist, ipps, dossie] = await Promise.all([
    historicoVersoesComentarios(a.video_id),
    buscarDistribuicaoIpps(),
    a.canal_id ? dossieCanonicoDoCanal(a.canal_id) : Promise.resolve(null),
  ]);
  const versoes = hist.status === "ok" ? hist.dados : [];
  const maisRecente = versoes[0];

  const total = a.total_analisados ?? 0;
  const indice = a.indice_pressao_produtiva === null ? null : Number(a.indice_pressao_produtiva);
  const faixa = indice === null || Number.isNaN(indice) ? null : faixaIpp(indice, ipps);
  const distribuicao = json<Record<string, number>>(a.distribuicao_dimensoes, {});
  const comentarios = json<ComentarioClassificado[]>(a.comentarios_brutos, []);
  const nPatrao = distribuicao.publico_patrao ?? 0;

  const dimensoes = Object.keys(DIMENSOES_VOZ).map((codigo) => ({ codigo, nome: tv(`dimensoes.${codigo}.nome`) }));
  const nomeDim = (c: string) => (c in DIMENSOES_VOZ ? tv(`dimensoes.${c}.nome`) : c);
  const hoje = new Date().toISOString().slice(0, 10);

  const corFaixa = faixa?.estado === "ok" ? (faixa.faixa === "alta" ? "orange" : faixa.faixa === "tipica" ? "purple" : "green") : "neutro";

  return (
    <Pagina className="max-w-5xl">
      <Link href="/biblioteca?aba=voz" className="label-caps inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden /> {tb("titulo")}
      </Link>

      {nova === "1" && (
        <p role="status" className="mt-6 flex items-center gap-2 rounded-lg border-l-2 border-cc-green bg-cc-surface px-4 py-3 text-sm">
          <CheckCircle2 aria-hidden className="size-4 text-cc-green" /> {t("nova")}
        </p>
      )}
      {maisRecente && maisRecente.id !== a.id && (
        <div className="mt-6">
          <Aviso>
            v{a.versao_numero ?? 1} →{" "}
            <Link href={`/biblioteca/voz/${maisRecente.id}`} className="text-cc-green underline underline-offset-4">
              v{maisRecente.versao_numero} ({tb("atual")})
            </Link>
          </Aviso>
        </div>
      )}

      <header className="mt-8">
        <Eyebrow>{t("rotulo", { versao: a.versao_numero ?? 1, data: data(a.data_analise) })}</Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(1.75rem,5vw,3.5rem)] leading-[1] [overflow-wrap:anywhere]" lang="pt-BR">
          “{Array.from(a.titulo_video ?? a.video_id).slice(0, 80).join("")}”
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">{rico(t("cabecalho", { canal: a.canal_nome ?? "—", n: total }))}</p>
      </header>

      <div className="mt-6">
        <BotaoSessao modulo="voz" id={a.id} rotulo={a.titulo_video ?? a.video_id} automatico={nova === "1"} />
      </div>

      {/* Índice de Pressão Produtiva */}
      <section className="mt-12" aria-labelledby="ipp">
        <div
          className={cn(
            "rounded-2xl border-l-[6px] bg-cc-surface p-6 sm:p-8",
            corFaixa === "orange" && "border-cc-orange",
            corFaixa === "purple" && "border-cc-purple",
            corFaixa === "green" && "border-cc-green",
            corFaixa === "neutro" && "border-cc-line",
          )}
        >
          <Eyebrow><span id="ipp">{t("ippRotulo")}</span></Eyebrow>
          <p
            className={cn(
              "mt-3 font-display text-6xl leading-none tabular-nums sm:text-7xl",
              corFaixa === "orange" && "text-cc-orange",
              corFaixa === "purple" && "text-cc-purple-text",
              corFaixa === "green" && "text-cc-green",
            )}
          >
            {indice === null || Number.isNaN(indice) ? tc("semDados") : `${dec(indice, 0)}%`}
          </p>
          {faixa?.estado === "insuficiente" && (
            <>
              <p className="mt-4 font-semibold">{t("ippInsuficiente", { n: faixa.nCorpus, min: MIN_CORPUS_PARA_PERCENTIS })}</p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{t("ippInsuficienteTexto", { min: MIN_CORPUS_PARA_PERCENTIS })}</p>
            </>
          )}
          {faixa?.estado === "ok" && (
            <>
              <p className="mt-4 font-semibold">{t(`faixa.${faixa.faixa}`)}</p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{t(`faixaTexto.${faixa.faixa}`)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{rico(t("percentil", { p: dec(faixa.percentil, 0), n: faixa.nCorpus }))}</p>
            </>
          )}
          {total > 0 && (
            <p className="mt-4 border-t border-cc-line pt-4 text-xs leading-relaxed text-muted-foreground">
              {rico(t("ippConferencia", { n: nPatrao, total, pct: dec((nPatrao / total) * 100, 0) }))}
            </p>
          )}
        </div>
      </section>

      {/* Distribuição por dimensão */}
      <section className="mt-16" aria-labelledby="distribuicao">
        <SectionTitle><span id="distribuicao">{t("distribuicaoTitulo")}</span></SectionTitle>
        <div className="mb-4 rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-3 text-sm leading-relaxed">
          <p className="label-caps mb-1 text-cc-orange">{t("exploratoriaTitulo")}</p>
          {rico(t("exploratoria"))}
        </div>
        <p className="mb-6 max-w-prose text-sm text-muted-foreground">{t("multiRotulo")}</p>
        {Object.keys(distribuicao).length === 0 ? (
          <Aviso>{tc("semDados")}</Aviso>
        ) : (
          <Barras
            cor="roxo"
            total={total}
            casasPct={1}
            rotuloTotal={t("deComentarios", { n: total })}
            itens={Object.entries(distribuicao).map(([chave, valor]) => ({ chave, rotulo: nomeDim(chave), valor }))}
          />
        )}
        <dl className="mt-6 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
          {dimensoes.map((d) => (
            <div key={d.codigo}>
              <dt className="font-semibold text-foreground">{d.nome}</dt>
              <dd className="text-muted-foreground">{tv(`dimensoes.${d.codigo}.descricao`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Síntese */}
      <section className="mt-16" aria-labelledby="sintese">
        <SectionTitle><span id="sintese">{t("sinteseTitulo")}</span></SectionTitle>
        <p className="mb-6 rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-3 text-sm leading-relaxed">{rico(t("avisoSintese"))}</p>
        <div lang="pt-BR" className="space-y-4 rounded-xl border-l-4 border-foreground bg-cc-surface p-6 leading-relaxed">
          <Prosa texto={String(a.sintese_qualitativa ?? "")} />
        </div>
      </section>

      {/* Contradição (só quando o modelo a identificou) */}
      {a.contradicao_estrutural && (
        <section className="mt-16" aria-labelledby="contradicao">
          <SectionTitle><span id="contradicao">{t("contradicaoTitulo")}</span></SectionTitle>
          <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("contradicaoLegenda")}</p>
          <div lang="pt-BR" className="space-y-4 rounded-xl bg-cc-purple p-6 leading-relaxed text-foreground">
            <Prosa texto={a.contradicao_estrutural} />
          </div>
          {dossie && (
            <Link href={`/biblioteca/canal/${dossie}`} className="mt-3 inline-block text-sm text-cc-green hover:underline">
              {t("verDossie")}
            </Link>
          )}
        </section>
      )}

      {/* Comentários */}
      <section className="mt-16" aria-labelledby="comentarios">
        <SectionTitle><span id="comentarios">{t("comentariosTitulo")}</span></SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("comentariosLegenda")}</p>
        {comentarios.length === 0 ? (
          <Aviso>{tc("semDados")}</Aviso>
        ) : (
          <Comentarios comentarios={comentarios} dimensoes={dimensoes} arquivoCsv={`raio-x-voz-${a.video_id}-${hoje}.csv`} />
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(a.video_id)}`} target="_blank" rel="noopener noreferrer">
            {t("verVideo")} <ExternalLink aria-hidden />
          </a>
        </Button>
        <Button asChild>
          <Link href="/voz">{t("novaAnalise")}</Link>
        </Button>
      </div>

      {versoes.length > 1 && (
        <section className="mt-14 border-t border-cc-line pt-8" aria-labelledby="historico">
          <h2 id="historico" className="font-display text-2xl text-cc-green">{tb("historicoTitulo", { n: versoes.length })}</h2>
          <ol className="mt-4 space-y-2">
            {versoes.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/biblioteca/voz/${h.id}`}
                  aria-current={h.id === a.id ? "page" : undefined}
                  className={cn("flex flex-wrap items-baseline gap-x-3 rounded-lg px-3 py-2 text-sm", h.id === a.id ? "bg-cc-surface-2" : "hover:bg-cc-surface")}
                >
                  <span className="text-xs">v{h.versao_numero}</span>
                  <span className="text-xs text-muted-foreground">{data(h.data_analise)}</span>
                  <span>IPP {h.indice_pressao_produtiva === null ? "—" : `${dec(Number(h.indice_pressao_produtiva), 0)}%`}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Pagina>
  );
}

