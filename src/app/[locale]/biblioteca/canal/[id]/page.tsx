import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Eyebrow, SectionTitle } from "@/components/brand/Brand";
import { Barras } from "@/components/barras";
import { Metricas } from "@/components/metricas";
import { Aviso, Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { Button } from "@/components/ui/button";
import { BotaoSessao } from "@/components/sessao/botao-sessao";
import { dossiePorId, historicoVersoesDossie } from "@/lib/corpus";
import { aparicoesEmBuscas, aparicoesNoTermometro } from "@/lib/dossie/registro";
import type { Sintomas } from "@/lib/dossie/sintomas";
import { buscarProdutor, nomeConteudo, nomeProdutor } from "@/lib/tipologia";
import { cn } from "@/lib/utils";

export const revalidate = 300;
export const dynamicParams = true;

type Props = PageProps<"/[locale]/biblioteca/canal/[id]">;

async function carregar(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return dossiePorId(id);
}

function json<T>(s: string | null | undefined, padrao: T): T {
  if (!s) return padrao;
  try {
    return JSON.parse(s) as T;
  } catch {
    return padrao;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const r = await carregar(id);
  if (r.status !== "ok" || !r.dados) return {};
  const d = r.dados;
  const descricao = `${nomeProdutor(d.classificacao_sociologica, locale)} × ${nomeConteudo(d.tipo_conteudo_predominante, locale)}`;
  return { title: d.canal_nome ?? `#${d.id}`, description: descricao, openGraph: { title: d.canal_nome ?? "", description: descricao } };
}

export default async function DossieCanal({ params, searchParams }: Props) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const { nova } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("DossieResultado");
  const tb = await getTranslations("Biblioteca");
  const tc = await getTranslations("Comum");
  const format = await getFormatter();
  const data = (iso: string | null | undefined) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "—");
  const num = (n: number | null | undefined) => (n === null || n === undefined ? null : format.number(n));
  // Mesmo formato do Streamlit (f"{x:.2f}", f"{x:.1f}", f"{x:.0f}"), com separador do idioma.
  const dec = (n: number, casas: number) => format.number(n, { minimumFractionDigits: casas, maximumFractionDigits: casas });

  const r = await carregar(id);
  if (r.status === "sem_banco") return <Pagina><Aviso>{tc("semBanco")}</Aviso></Pagina>;
  if (r.status === "erro") return <Pagina><Aviso tom="erro">{tc("erroConsulta", { erro: r.mensagem })}</Aviso></Pagina>;
  const d = r.dados;
  if (!d) notFound();

  const s = json<Partial<Sintomas>>(d.sintomas_estruturais, {});
  const rede = json<{ id: string; nome: string; inscritos: number; total_videos: number }[]>(d.rede_canais, []);
  const composicao = json<Record<string, number>>(d.composicao_videos, {});
  const produtor = buscarProdutor(d.classificacao_sociologica);
  const analisados = d.total_videos_analisados ?? 0;

  const [hist, termometro, buscas] = await Promise.all([
    historicoVersoesDossie(d.canal_id),
    aparicoesNoTermometro(d.canal_id).catch(() => null),
    aparicoesEmBuscas(d.canal_id),
  ]);
  const versoes = hist.status === "ok" ? hist.dados : [];
  const maisRecente = versoes[0];

  const totalShorts = s.total_shorts ?? 0;
  const totalLongos = s.total_longos ?? 0;
  const totalInconc = s.total_inconclusivos ?? 0;
  // Streamlit: `x or 0` e "—" quando zero/ausente
  const freq = (v: number | null | undefined) => (v ? t("porDia", { n: dec(v, 2) }) : "—");
  const durMin = (s.duracao_mediana_segundos ?? 0) / 60;

  const paragrafos = (d.veredito_sonnet ?? "").split(/\n\n+/);

  return (
    <Pagina className="max-w-5xl">
      <Link href="/biblioteca?aba=canais" className="label-caps inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden /> {tb("titulo")}
      </Link>

      {nova === "1" && (
        <p role="status" className="mt-6 flex items-center gap-2 rounded-lg border-l-2 border-cc-green bg-cc-surface px-4 py-3 text-sm">
          <CheckCircle2 aria-hidden className="size-4 text-cc-green" /> {t("nova")}
        </p>
      )}
      {maisRecente && maisRecente.id !== d.id && (
        <div className="mt-6">
          <Aviso>
            v{d.versao_numero ?? 1} →{" "}
            <Link href={`/biblioteca/canal/${maisRecente.id}`} className="text-cc-green underline underline-offset-4">
              v{maisRecente.versao_numero} ({tb("atual")})
            </Link>
          </Aviso>
        </div>
      )}

      <header className="mt-8">
        <Eyebrow>{t("rotulo", { versao: d.versao_numero ?? 1, data: data(d.data_dossie) })}</Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(2rem,7vw,4.5rem)] leading-[0.95] [overflow-wrap:anywhere]">{d.canal_nome}</h1>
      </header>

      <div className="mt-6">
        <BotaoSessao modulo="dossie" id={d.id} rotulo={d.canal_nome ?? d.canal_id} automatico={nova === "1"} />
      </div>

      <div className="mt-8">
        <Metricas
          itens={[
            { rotulo: t("inscritos"), valor: num(d.inscritos) },
            { rotulo: t("totalVideos"), valor: num(d.total_videos_canal) },
            { rotulo: t("analisados"), valor: num(d.total_videos_analisados) },
          ]}
        />
      </div>

      {/* Confronto auto-narrativa × realidade */}
      <section className="mt-16" aria-labelledby="confronto">
        <SectionTitle><span id="confronto">{t("confrontoTitulo")}</span></SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("confrontoLegenda")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border-l-4 border-cc-purple bg-cc-surface p-6">
            <Eyebrow>{t("comoSeApresenta")}</Eyebrow>
            <p className="mt-3 text-lg leading-relaxed" lang="pt-BR">“{d.auto_classificacao || "—"}”</p>
          </div>
          <div className="rounded-2xl border-l-4 border-cc-green bg-cc-surface p-6">
            <Eyebrow>{t("classeReal")}</Eyebrow>
            <p className="mt-3 font-display text-3xl leading-none text-cc-green">{nomeProdutor(d.classificacao_sociologica, locale)}</p>
            {produtor && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{rico(produtor.definicao[locale])}</p>}
          </div>
        </div>
        <p className="mt-4 text-sm">
          <span className="text-muted-foreground">{t("conteudoPredominante")}: </span>
          <strong className="text-cc-purple-text">{nomeConteudo(d.tipo_conteudo_predominante, locale)}</strong>
        </p>
      </section>

      {/* Sintomas */}
      <section className="mt-16" aria-labelledby="dados">
        <SectionTitle><span id="dados">{t("dadosTitulo")}</span></SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("dadosLegenda")}</p>
        <p className="mb-8 rounded-lg border-l-2 border-cc-line bg-cc-surface px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {rico(t("notaMetodologica"))}
        </p>

        {(totalShorts > 0 || totalLongos > 0) && (
          <>
            <h3 className="mb-3 font-display text-lg text-cc-purple-text">{t("formato")}</h3>
            <Metricas
              itens={[
                { rotulo: t("shorts"), valor: String(totalShorts), ajuda: t("shortsAjuda") },
                { rotulo: t("longos"), valor: String(totalLongos), ajuda: t("longosAjuda") },
                {
                  rotulo: t("pctShorts"),
                  valor: `${dec(s.pct_shorts ?? 0, 0)}%`,
                  ajuda: t("pctShortsAjuda", { total: totalShorts + totalLongos + totalInconc, inconc: totalInconc }),
                },
              ]}
            />
          </>
        )}

        <h3 className="mt-8 mb-3 font-display text-lg text-cc-purple-text">{t("frequencia")}</h3>
        <Metricas
          itens={[
            { rotulo: t("freqTotal"), valor: freq(s.frequencia_videos_por_dia), ajuda: t("freqTotalAjuda") },
            { rotulo: t("shorts"), valor: freq(s.frequencia_shorts_por_dia), ajuda: t("freqShortsAjuda") },
            { rotulo: t("longos"), valor: freq(s.frequencia_longos_por_dia), ajuda: t("freqLongosAjuda") },
          ]}
        />

        <h3 className="mt-8 mb-3 font-display text-lg text-cc-purple-text">{t("outros")}</h3>
        <Metricas
          colunas={2}
          itens={[
            { rotulo: t("duracao"), valor: durMin ? t("minutos", { n: dec(durMin, 1) }) : "—", ajuda: t("duracaoAjuda") },
            { rotulo: t("padronizados"), valor: `${dec(s.pct_titulos_padronizados ?? 0, 0)}%`, ajuda: t("padronizadosAjuda") },
          ]}
        />

        {!!s.inscritos && (
          <p className="mt-4 rounded-lg bg-cc-surface px-4 py-3 text-sm text-muted-foreground">
            {rico(t("inscritosInfo", { n: format.number(s.inscritos) }))}
          </p>
        )}
        {s.link_externo_repetido && (
          <p className="mt-4 rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-3 text-sm leading-relaxed">
            {rico(t("linkRepetido", { dominio: s.link_externo_repetido.dominio, n: s.link_externo_repetido.n_aparicoes }))}
          </p>
        )}
      </section>

      {/* Composição (Eixo B dos vídeos) */}
      {Object.keys(composicao).length > 0 && (
        <section className="mt-16" aria-labelledby="composicao">
          <SectionTitle><span id="composicao">{t("composicaoTitulo")}</span></SectionTitle>
          <Barras
            cor="roxo"
            total={analisados}
            rotuloTotal={t("deVideos", { n: analisados })}
            itens={Object.entries(composicao).map(([chave, valor]) => ({ chave, rotulo: nomeConteudo(chave, locale), valor }))}
          />
          <p className="mt-3 text-xs text-muted-foreground">{t("deVideos", { n: analisados })}</p>
        </section>
      )}

      {/* Rede */}
      <section className="mt-16" aria-labelledby="rede">
        <SectionTitle><span id="rede">{t("redeTitulo")}</span></SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("redeLegenda")}</p>
        {rede.length === 0 ? (
          <Aviso>{t("redeVazia")}</Aviso>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold">{t("redeN", { n: rede.length })}</p>
            <div className="overflow-x-auto rounded-xl border border-cc-line">
              <table className="w-full text-sm">
                <thead className="bg-cc-surface text-left">
                  <tr>
                    <th className="label-caps px-4 py-3 text-muted-foreground">{t("colNome")}</th>
                    <th className="label-caps px-4 py-3 text-right text-muted-foreground">{t("colInscritos")}</th>
                    <th className="label-caps px-4 py-3 text-right text-muted-foreground">{t("colVideos")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rede.map((c) => (
                    <tr key={c.id} className="border-t border-cc-line">
                      <td className="px-4 py-2.5">
                        <a href={`https://www.youtube.com/channel/${c.id}`} target="_blank" rel="noopener noreferrer" className="hover:text-cc-green hover:underline">
                          {c.nome}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{format.number(c.inscritos)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{format.number(c.total_videos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Presença nos outros módulos */}
      <section className="mt-16" aria-labelledby="presenca">
        <SectionTitle><span id="presenca">{t("presencaTitulo")}</span></SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-l-4 border-cc-green bg-cc-surface p-6">
            <Eyebrow>{t("noTermometro")}</Eyebrow>
            <p className="mt-2 font-display text-4xl text-cc-green">{termometro === null ? "—" : termometro.length}</p>
            <p className="text-sm text-muted-foreground">{t("noTermometroTexto")}</p>
          </div>
          <div className="rounded-2xl border-l-4 border-cc-purple bg-cc-surface p-6">
            <Eyebrow>{t("naDisputa")}</Eyebrow>
            <p className="mt-2 font-display text-4xl text-cc-purple-text">{buscas.length}</p>
            <p className="text-sm text-muted-foreground">{t("naDisputaTexto")}</p>
          </div>
        </div>
        {buscas.length > 0 && (
          <details className="mt-4 rounded-xl border border-cc-line bg-cc-surface">
            <summary className="label-caps cursor-pointer px-5 py-4 text-muted-foreground hover:text-foreground">{t("verBuscas")}</summary>
            <ul className="space-y-1 border-t border-cc-line px-5 py-4 text-sm">
              {buscas.slice(0, 20).map((b, i) =>
                b.buscas_narrativa ? (
                  <li key={i}>
                    {t("buscaItem", { termo: b.buscas_narrativa.termo_buscado, pos: b.posicao_ranking, data: data(b.buscas_narrativa.data_busca) })}
                  </li>
                ) : null,
              )}
            </ul>
          </details>
        )}
      </section>

      {/* Leitura final */}
      <section className="mt-16" aria-labelledby="leitura">
        <SectionTitle><span id="leitura">{t("leituraTitulo")}</span></SectionTitle>
        <p className="mb-6 rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-3 text-sm leading-relaxed">{rico(t("aviso"))}</p>
        <div lang="pt-BR" className="space-y-4 rounded-xl border-l-4 border-foreground bg-cc-surface p-6 leading-relaxed">
          {paragrafos.map((p, i) => (
            <p key={i}>
              {p.split("\n").map((linha, j) => (
                <span key={j} className={cn(j > 0 && "block")}>
                  {rico(linha)}
                </span>
              ))}
            </p>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <a href={`https://www.youtube.com/channel/${encodeURIComponent(d.canal_id)}`} target="_blank" rel="noopener noreferrer">
            {t("verNoYoutube")} <ExternalLink aria-hidden />
          </a>
        </Button>
        <Button asChild>
          <Link href="/dossie">{t("novoDossie")}</Link>
        </Button>
      </div>

      {versoes.length > 1 && (
        <section className="mt-14 border-t border-cc-line pt-8" aria-labelledby="historico">
          <h2 id="historico" className="font-display text-2xl text-cc-green">{tb("historicoTitulo", { n: versoes.length })}</h2>
          <ol className="mt-4 space-y-2">
            {versoes.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/biblioteca/canal/${h.id}`}
                  aria-current={h.id === d.id ? "page" : undefined}
                  className={cn("flex flex-wrap items-baseline gap-x-3 rounded-lg px-3 py-2 text-sm", h.id === d.id ? "bg-cc-surface-2" : "hover:bg-cc-surface")}
                >
                  <span className="text-xs">v{h.versao_numero}</span>
                  <span className="text-xs text-muted-foreground">{data(h.data_dossie)}</span>
                  <span className="text-cc-green">{nomeProdutor(h.classificacao_sociologica, locale)}</span>
                  <span className="text-cc-purple-text">{nomeConteudo(h.tipo_conteudo_predominante, locale)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Pagina>
  );
}

