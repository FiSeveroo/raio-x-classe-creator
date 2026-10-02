import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
import { buscaPorId, historicoVersoesBusca, resultadosDeBusca } from "@/lib/corpus";
import { ausencias, contar, MIN_SNAPSHOTS_PARA_QUIQUADRADO, tabelaDesvios, testeAderencia } from "@/lib/disputa/analise";
import { linhaDeBaseDisputa, type LinhaDeBase } from "@/lib/termometro/corpus";
import { CONTEUDOS, nomeConteudo, nomeProdutor, PRODUTORES } from "@/lib/tipologia";
import { cn } from "@/lib/utils";
import { Ranking } from "./ranking";

export const revalidate = 300;
export const dynamicParams = true;

type Props = PageProps<"/[locale]/biblioteca/tema/[id]">;

async function carregar(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return buscaPorId(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const r = await carregar(id);
  if (r.status !== "ok" || !r.dados) return {};
  const tm = await getTranslations({ locale, namespace: "Modulos" });
  const titulo = `“${r.dados.termo_buscado}” · ${tm("disputa.nome")}`;
  return { title: titulo, description: tm("disputa.frase"), openGraph: { title: titulo, description: tm("disputa.frase") } };
}

export default async function TemaAuditado({ params, searchParams }: Props) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  const { nova } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("DisputaResultado");
  const tb = await getTranslations("Biblioteca");
  const tc = await getTranslations("Comum");
  const format = await getFormatter();
  const data = (iso: string | null | undefined) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "—");
  const dec = (n: number, casas: number, sinal = false) =>
    format.number(n, { minimumFractionDigits: casas, maximumFractionDigits: casas, signDisplay: sinal ? "always" : "auto" });

  const r = await carregar(id);
  if (r.status === "sem_banco") return <Pagina><Aviso>{tc("semBanco")}</Aviso></Pagina>;
  if (r.status === "erro") return <Pagina><Aviso tom="erro">{tc("erroConsulta", { erro: r.mensagem })}</Aviso></Pagina>;
  const b = r.dados;
  if (!b) notFound();

  const [res, hist, base] = await Promise.all([
    resultadosDeBusca(b.id),
    historicoVersoesBusca(b.termo_buscado, b.tipo_resultado),
    linhaDeBaseDisputa().then(
      (v): { ok: true; v: LinhaDeBase } => ({ ok: true, v }),
      (e): { ok: false; erro: string } => ({ ok: false, erro: e instanceof Error ? e.message : String(e) }),
    ),
  ]);
  if (res.status !== "ok") return <Pagina><Aviso tom="erro">{tc("erroConsulta", { erro: res.status === "erro" ? res.mensagem : "" })}</Aviso></Pagina>;
  const itens = res.dados;
  const versoes = hist.status === "ok" ? hist.dados : [];
  const maisRecente = versoes[0];

  const n = itens.length;
  const contagemA = contar(itens.map((i) => i.tipo_produtor));
  const contagemB = contar(itens.map((i) => i.tipo_conteudo));
  const pct = (codigo: string) => (n ? `${dec(((contagemA[codigo] ?? 0) / n) * 100, 0)}%` : null);
  const fora = ausencias(new Set(Object.keys(contagemA)));

  const nomesProdutor = Object.fromEntries(PRODUTORES.map((p) => [p.codigo, p.nome[locale]]));
  const nomesConteudo = Object.fromEntries(CONTEUDOS.map((c) => [c.codigo, c.nome[locale]]));
  const hoje = new Date().toISOString().slice(0, 10);
  const arquivoCsv = `raio-x-disputa-${Array.from(b.termo_buscado).slice(0, 30).join("").replace(/ /g, "_")}-${hoje}.csv`;

  return (
    <Pagina className="max-w-5xl">
      <Link href="/biblioteca?aba=temas" className="label-caps inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden /> {tb("titulo")}
      </Link>

      {nova === "1" && (
        <p role="status" className="mt-6 flex items-center gap-2 rounded-lg border-l-2 border-cc-green bg-cc-surface px-4 py-3 text-sm">
          <CheckCircle2 aria-hidden className="size-4 text-cc-green" /> {t("nova")}
        </p>
      )}
      {maisRecente && maisRecente.id !== b.id && (
        <div className="mt-6">
          <Aviso>
            v{b.versao_numero ?? 1} →{" "}
            <Link href={`/biblioteca/tema/${maisRecente.id}`} className="text-cc-green underline underline-offset-4">
              v{maisRecente.versao_numero} ({tb("atual")})
            </Link>
          </Aviso>
        </div>
      )}

      <header className="mt-8">
        <Eyebrow>{t("rotulo", { versao: b.versao_numero ?? 1, data: data(b.data_busca) })}</Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(2rem,7vw,4.5rem)] leading-[0.95] [overflow-wrap:anywhere]" lang="pt-BR">
          “{b.termo_buscado}”
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">{t("analisados", { n, id: b.id })}</p>
      </header>

      <div className="mt-6">
        <BotaoSessao modulo="disputa" id={b.id} rotulo={b.termo_buscado} automatico={nova === "1"} />
      </div>

      {n === 0 ? (
        <div className="mt-10"><Aviso>{tc("semDados")}</Aviso></div>
      ) : (
        <>
          {/* Quem ganhou visibilidade */}
          <section className="mt-14" aria-labelledby="visibilidade">
            <SectionTitle><span id="visibilidade">{t("visibilidadeTitulo")}</span></SectionTitle>
            <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("visibilidadeLegenda")}</p>
            <Metricas
              colunas={4}
              itens={[
                { rotulo: t("pctMidia"), valor: pct("midia_tradicional") },
                { rotulo: t("pctProdutora"), valor: pct("produtora_digital") },
                { rotulo: t("pctYoutuber"), valor: pct("youtuber_profissional") },
                { rotulo: t("pctInstituicoes"), valor: pct("instituicao") },
              ]}
            />
          </section>

          {/* Desvio em relação ao Termômetro */}
          <section className="mt-16" aria-labelledby="desvio">
            <SectionTitle><span id="desvio">{t("desvioTitulo")}</span></SectionTitle>
            <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("desvioLegenda", { min: MIN_SNAPSHOTS_PARA_QUIQUADRADO })}</p>
            {!base.ok ? (
              <Aviso tom="erro">{t("baseErro", { erro: base.erro })}</Aviso>
            ) : base.v.n_videos === 0 ? (
              <Aviso>{t("baseSemDados")}</Aviso>
            ) : (
              desvios(contagemA, n, base.v)
            )}
          </section>

          {/* Composição */}
          <section className="mt-16" aria-labelledby="composicao">
            <SectionTitle><span id="composicao">{t("composicaoTitulo")}</span></SectionTitle>
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="mb-4 font-display text-lg text-cc-purple-text">{t("porProdutor")}</h3>
                <Barras total={n} rotuloTotal={t("deItens", { n })} itens={Object.entries(contagemA).map(([chave, valor]) => ({ chave, rotulo: nomeProdutor(chave, locale), valor }))} />
              </div>
              <div>
                <h3 className="mb-4 font-display text-lg text-cc-purple-text">{t("porConteudo")}</h3>
                <Barras cor="roxo" total={n} rotuloTotal={t("deItens", { n })} itens={Object.entries(contagemB).map(([chave, valor]) => ({ chave, rotulo: nomeConteudo(chave, locale), valor }))} />
              </div>
            </div>
          </section>

          {/* Quem ficou de fora */}
          <section className="mt-16" aria-labelledby="fora">
            <SectionTitle><span id="fora">{t("foraTitulo")}</span></SectionTitle>
            <div className="space-y-6">
              {fora.extintas.length > 0 && (
                <div className="rounded-2xl border-l-4 border-cc-purple bg-cc-surface p-6">
                  <Eyebrow>{t("extintasTitulo")}</Eyebrow>
                  <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">{rico(t("extintasTexto"))}</p>
                  <ul className="mt-5 space-y-3">
                    {fora.extintas.map((c) => (
                      <li key={c} className="rounded-lg bg-cc-surface-2 p-4">
                        <strong className="block">{nomeProdutor(c, locale)}</strong>
                        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{t(`extinta.${c}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fora.relevantes.length > 0 ? (
                <div className="rounded-2xl border-l-4 border-cc-orange bg-cc-surface p-6">
                  <Eyebrow className="text-cc-orange">{t("relevantesTitulo")}</Eyebrow>
                  <p className="mt-3 max-w-prose text-sm leading-relaxed">{rico(t("relevantesTexto"))}</p>
                  <ul className="mt-5 space-y-2">
                    {fora.relevantes.map((a) => (
                      <li key={a.codigo} className="rounded-lg bg-cc-surface-2 px-4 py-3 text-sm">
                        <strong>{nomeProdutor(a.codigo, locale)}</strong>
                        <span className="text-muted-foreground"> — {t("relevanteItem", { prev: dec(a.prevalencia, 1), p: dec(a.pZero * 100, 1) })}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-muted-foreground">{t("relevantesFonte")}</p>
                </div>
              ) : fora.esperaveis.length > 0 ? (
                <Aviso>
                  <strong className="text-foreground">{t("esperaveisTitulo")}</strong>{" "}
                  {t("esperaveisTexto", { lista: fora.esperaveis.map((a) => nomeProdutor(a.codigo, locale)).join(", ") })}
                </Aviso>
              ) : (
                <Aviso>{t("nenhumaAusencia")}</Aviso>
              )}
            </div>
          </section>

          {/* Ranking */}
          <section className="mt-16" aria-labelledby="ranking">
            <SectionTitle><span id="ranking">{t("rankingTitulo")}</span></SectionTitle>
            <p className="-mt-2 mb-4 max-w-prose text-sm text-muted-foreground">{t("rankingLegenda")}</p>
            <p className="mb-6 rounded-lg border-l-2 border-cc-line bg-cc-surface px-4 py-3 text-xs leading-relaxed text-muted-foreground">{t("avisoIa")}</p>
            <Ranking itens={itens} nomesProdutor={nomesProdutor} nomesConteudo={nomesConteudo} arquivoCsv={arquivoCsv} />
          </section>
        </>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/disputa">{t("novaBusca")}</Link>
        </Button>
      </div>

      {versoes.length > 1 && (
        <section className="mt-14 border-t border-cc-line pt-8" aria-labelledby="historico">
          <h2 id="historico" className="font-display text-2xl text-cc-green">{tb("historicoTitulo", { n: versoes.length })}</h2>
          <ol className="mt-4 space-y-2">
            {versoes.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/biblioteca/tema/${h.id}`}
                  aria-current={h.id === b.id ? "page" : undefined}
                  className={cn("flex flex-wrap items-baseline gap-x-3 rounded-lg px-3 py-2 text-sm", h.id === b.id ? "bg-cc-surface-2" : "hover:bg-cc-surface")}
                >
                  <span className="text-xs">v{h.versao_numero}</span>
                  <span className="text-xs text-muted-foreground">{data(h.data_busca)}</span>
                  <span>{t("analisados", { n: h.total_analisados ?? 0, id: h.id })}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Pagina>
  );

  /** Bloco do teste + tabela de desvios (sempre exibida quando há linha de base). */
  function desvios(contagem: Record<string, number>, n: number, base: LinhaDeBase) {
    const linhas = tabelaDesvios(contagem, n, base.composicao_proporcional);
    const maxAbs = Math.max(1, ...linhas.map((l) => Math.abs(l.desvio)));
    const teste = base.n_snapshots >= MIN_SNAPSHOTS_PARA_QUIQUADRADO ? testeAderencia(contagem, n, base.composicao_proporcional) : null;
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {rico(t("baseInfo", { videos: format.number(base.n_videos), snapshots: base.n_snapshots }))}
        </p>

        {teste === null ? (
          <div className="rounded-xl border-l-4 border-cc-orange bg-cc-surface p-5">
            <Eyebrow className="text-cc-orange">{t("preliminarTitulo")}</Eyebrow>
            <p className="mt-2 text-sm leading-relaxed">{rico(t("preliminarTexto", { n: base.n_snapshots, min: MIN_SNAPSHOTS_PARA_QUIQUADRADO }))}</p>
          </div>
        ) : teste.estado === "poucas_categorias" ? (
          <Aviso>{t("poucasCategorias")}</Aviso>
        ) : (
          <div className={cn("rounded-xl border-l-4 bg-cc-surface p-5", teste.nivel === "nenhum" ? "border-cc-green" : "border-cc-orange")}>
            <Eyebrow>{t("quiRotulo")}</Eyebrow>
            <p className={cn("mt-2 font-display text-xl leading-snug", teste.nivel === "nenhum" ? "text-cc-green" : "text-cc-orange")}>
              {t(`nivel.${teste.nivel}`, { p: dec(teste.p, 4) })}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("quiDetalhe", { chi2: dec(teste.chi2, 2), gl: teste.gl, videos: format.number(base.n_videos), snapshots: base.n_snapshots })}
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-cc-line">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-cc-surface text-left">
              <tr>
                <th className="label-caps px-4 py-3 text-muted-foreground">{t("colCategoria")}</th>
                <th className="label-caps px-4 py-3 text-right text-muted-foreground">{t("colBusca")}</th>
                <th className="label-caps px-4 py-3 text-right text-muted-foreground">{t("colCorpus")}</th>
                <th className="label-caps px-4 py-3 text-right text-muted-foreground">{t("colDesvio")}</th>
                <th className="w-32 px-4 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.codigo} className="border-t border-cc-line">
                  <td className="px-4 py-2.5">{nomeProdutor(l.codigo, locale)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{dec(l.pctBusca, 1)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{dec(l.pctCorpus, 1)}%</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">{dec(l.desvio, 1, true)}</td>
                  <td className="px-4 py-2.5" aria-hidden>
                    {/* Barra divergente: centro = sem desvio; direita = acima do trending, esquerda = abaixo. */}
                    <span className="relative block h-2.5 rounded-sm bg-cc-surface-2">
                      <span className="absolute inset-y-0 left-1/2 w-px bg-cc-line" />
                      <span
                        className={cn("absolute inset-y-0 rounded-sm", l.desvio >= 0 ? "left-1/2 bg-cc-green" : "right-1/2 bg-cc-purple-text")}
                        style={{ width: `${(Math.abs(l.desvio) / maxAbs) * 50}%` }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
