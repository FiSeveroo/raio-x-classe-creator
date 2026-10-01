import type { Metadata } from "next";
import { Download, LogOut } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Eyebrow, SectionTitle } from "@/components/brand/Brand";
import { Barras } from "@/components/barras";
import { MapaCalor, MiniSerie, N_MINIMO } from "@/components/graficos";
import { Metricas } from "@/components/metricas";
import { Aviso, Pagina } from "@/components/pagina";
import { Paragrafos, rico } from "@/components/rico";
import { Button } from "@/components/ui/button";
import {
  agregadosTermometro,
  ehClassificado,
  listarSnapshots,
  videosDoSnapshot,
  type Agregados,
  type Snapshot,
} from "@/lib/termometro/corpus";
import { CONTEUDOS, PRODUTORES, nomeConteudo, nomeProdutor } from "@/lib/tipologia";
import { cn } from "@/lib/utils";
import { painelLiberado, sairPainel } from "./acoes";
import { FormularioSenha } from "./formulario-senha";

export const maxDuration = 60;

const ABAS = ["coleta", "serie", "canais", "exportar"] as const;
type Aba = (typeof ABAS)[number];

export async function generateMetadata({ params }: PageProps<"/[locale]/termometro">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Modulos" });
  return { title: t("termometro.nome"), description: t("termometro.frase") };
}

export default async function Termometro({ params, searchParams }: PageProps<"/[locale]/termometro">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const sp = await searchParams;
  const aba: Aba = ABAS.includes(sp.aba as Aba) ? (sp.aba as Aba) : "coleta";
  const t = await getTranslations("Termometro");
  const tm = await getTranslations("Modulos");
  const tc = await getTranslations("Comum");
  const format = await getFormatter();

  let snapshots: Snapshot[] = [];
  let agregados: Agregados | null = null;
  let erro: string | null = null;
  try {
    [snapshots, agregados] = await Promise.all([listarSnapshots(), agregadosTermometro()]);
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
  }
  const liberado = await painelLiberado();
  const recente = snapshots[0];

  return (
    <Pagina>
      <Eyebrow className="mb-6">02 · {tm("termometro.escala")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,10vw,8rem)] leading-[0.9] [overflow-wrap:anywhere] hyphens-auto">
        {tm("termometro.nome")}
      </h1>
      <p className="mt-6 font-display text-xl text-cc-green sm:text-2xl">{t("subtitulo")}</p>

      {erro && (
        <div className="mt-8">
          <Aviso tom="erro">{tc("erroConsulta", { erro })}</Aviso>
        </div>
      )}

      {!erro && !recente && <div className="mt-8"><Aviso>{rico(t("semColeta"))}</Aviso></div>}

      {recente && agregados && (
        <>
          <p className="mt-8 rounded-lg border-l-2 border-cc-green bg-cc-surface px-4 py-3 text-sm">
            <strong className="text-cc-green">{t("ultimaColeta")}:</strong>{" "}
            {t("ultimaColetaTexto", {
              data: format.dateTime(new Date(recente.data_coleta), { dateStyle: "short", timeStyle: "short" }),
              semana: recente.semana_ano ?? "—",
              dia: recente.dia_semana ?? "—",
              hora: recente.horario_coleta ?? "—",
              n: recente.total_videos_coletados ?? 0,
            })}
          </p>

          <div className="mt-10">
            <Eyebrow className="mb-4">{t("corpusRotulo")}</Eyebrow>
            <Metricas
              colunas={4}
              itens={[
                { rotulo: t("contadores.snapshots"), valor: format.number(snapshots.length) },
                { rotulo: t("contadores.videos"), valor: format.number(agregados.totalVideos) },
                {
                  rotulo: t("contadores.classificados"),
                  valor: format.number(agregados.totalClassificados),
                  ajuda: t("classificadosAjuda", {
                    pct: format.number((agregados.totalClassificados / Math.max(1, agregados.totalVideos)) * 100, { maximumFractionDigits: 2 }),
                  }),
                },
                { rotulo: t("contadores.canais"), valor: format.number(agregados.canais.length) },
              ]}
            />
          </div>
        </>
      )}

      {/* Painel */}
      <section className="mt-20" aria-labelledby="painel">
        {!liberado ? (
          <>
            <SectionTitle><span id="painel">{t("painelTitulo")}</span></SectionTitle>
            <p className="mb-6 max-w-prose text-muted-foreground">{t("painelTexto")}</p>
            <FormularioSenha voltar="/termometro" />
          </>
        ) : (
          agregados &&
          recente && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cc-line">
                <nav aria-label={t("painelTitulo")} className="flex gap-1 overflow-x-auto overflow-y-hidden">
                  {ABAS.map((a) => (
                    <Link
                      key={a}
                      href={a === "coleta" ? "/termometro" : { pathname: "/termometro", query: { aba: a } }}
                      scroll={false}
                      aria-current={a === aba ? "page" : undefined}
                      className={cn(
                        "label-caps -mb-px shrink-0 border-b-2 px-4 py-3 transition-colors",
                        a === aba ? "border-cc-green text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`abas.${a}`)}
                    </Link>
                  ))}
                </nav>
                {process.env.SENHA_PAINEL_INTERNO && (
                  <form action={sairPainel}>
                    <input type="hidden" name="voltar" value="/termometro" />
                    <Button type="submit" variant="ghost" size="sm" font="caps">
                      <LogOut aria-hidden /> {t("sair")}
                    </Button>
                  </form>
                )}
              </div>
              <div className="mt-10">
                {aba === "coleta" && <AbaColeta snapshots={snapshots} escolhido={Number(sp.snapshot) || recente.id} locale={locale} />}
                {aba === "serie" && <AbaSerie snapshots={snapshots} agregados={agregados} locale={locale} />}
                {aba === "canais" && <AbaCanais agregados={agregados} locale={locale} />}
                {aba === "exportar" && <AbaExportar agregados={agregados} />}
              </div>
              <p className="mt-12 text-xs text-muted-foreground">
                {t("atualizadoEm", { data: format.dateTime(new Date(agregados.geradoEm), { dateStyle: "short", timeStyle: "short" }) })}
                {" · "}
                {t("curadoriaNota")}
              </p>
            </>
          )
        )}
      </section>

      {/* Sobre */}
      <section className="mt-20" aria-labelledby="sobre-termometro">
        <SectionTitle tone="secondary"><span id="sobre-termometro">{t("sobreTitulo")}</span></SectionTitle>
        <Paragrafos textos={t.raw("sobreTexto") as string[]} className="prosa text-lg" />
      </section>

    </Pagina>
  );
}

// ---------------------------------------------------------------------------

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : null);

async function AbaColeta({ snapshots, escolhido, locale }: { snapshots: Snapshot[]; escolhido: number; locale: Locale }) {
  const t = await getTranslations("Termometro");
  const format = await getFormatter();
  const snap = snapshots.find((s) => s.id === escolhido) ?? snapshots[0];
  const videos = await videosDoSnapshot(snap.id);
  const rotulo = (s: Snapshot) =>
    `#${s.id} — ${format.dateTime(new Date(s.data_coleta), { dateStyle: "short", timeStyle: "short" })} (${s.dia_semana ?? ""} ${s.horario_coleta ?? ""})`;

  const seletor = (
    <form className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="label-caps mb-1.5 block text-muted-foreground">{t("coletaExaminar")}</span>
        <select
          name="snapshot"
          defaultValue={snap.id}
          className="h-10 w-full rounded-lg border border-input bg-cc-surface px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {snapshots.map((s) => (
            <option key={s.id} value={s.id}>
              {rotulo(s)}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="outline">{t("ver")}</Button>
    </form>
  );

  if (!videos.length) return <>{seletor}<Aviso>{t("coletaVazia")}</Aviso></>;

  const classificados = videos.filter((v) => ehClassificado(v.tipo_produtor, "A"));
  const contar = (lista: typeof videos, campo: "tipo_produtor" | "tipo_conteudo", eixo: "A" | "B") => {
    const m: Record<string, number> = {};
    for (const v of lista) if (ehClassificado(v[campo], eixo)) m[v[campo]!] = (m[v[campo]!] ?? 0) + 1;
    return m;
  };
  const contA = contar(videos, "tipo_produtor", "A");
  const contB = contar(videos, "tipo_conteudo", "B");
  const nC = classificados.length;
  const canaisUnicos = new Set(videos.map((v) => v.canal_id)).size;
  const shorts = videos.filter((v) => v.is_short === true).length;
  const longos = videos.filter((v) => v.is_short === false).length;
  const semDados = videos.length - shorts - longos;
  const endpoints: Record<string, number> = {};
  for (const v of videos) endpoints[v.categoria_coleta ?? "—"] = (endpoints[v.categoria_coleta ?? "—"] ?? 0) + 1;
  const pctTxt = (n: number | null) => (n === null ? null : `${format.number(n, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

  const cruz: Record<string, Record<string, number>> = {};
  for (const v of classificados) {
    if (!ehClassificado(v.tipo_conteudo, "B")) continue;
    cruz[v.tipo_produtor!] ??= {};
    cruz[v.tipo_produtor!][v.tipo_conteudo!] = (cruz[v.tipo_produtor!][v.tipo_conteudo!] ?? 0) + 1;
  }

  return (
    <div className="space-y-14">
      {seletor}

      <section>
        <SectionTitle as="h3">{t("composicaoTitulo")}</SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("composicaoLegenda")}</p>
        <Metricas
          colunas={4}
          itens={[
            { rotulo: t("videos"), valor: format.number(videos.length) },
            { rotulo: t("canaisUnicos"), valor: format.number(canaisUnicos) },
            { rotulo: t("pctMidia"), valor: pctTxt(pct(contA.midia_tradicional ?? 0, nC)), ajuda: t("sobreClassificados", { n: nC }) },
            { rotulo: t("pctUsuario"), valor: pctTxt(pct(contA.usuario_comum ?? 0, nC)), ajuda: t("sobreClassificados", { n: nC }) },
          ]}
        />
        {nC === 0 && <div className="mt-4"><Aviso tom="importante">{t("semClassificacao")}</Aviso></div>}
      </section>

      <section>
        <SectionTitle as="h3" tone="secondary">{t("formatoTitulo")}</SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("formatoLegenda")}</p>
        <Metricas
          colunas={4}
          itens={[
            { rotulo: t("shorts"), valor: format.number(shorts) },
            { rotulo: t("longos"), valor: format.number(longos) },
            { rotulo: t("pctShorts"), valor: pctTxt(pct(shorts, shorts + longos)) ?? "—", ajuda: t("pctShortsAjuda") },
            { rotulo: t("semDadosFormato"), valor: format.number(semDados), ajuda: t("semDadosFormatoAjuda") },
          ]}
        />
      </section>

      <section>
        <SectionTitle as="h3" tone="secondary">{t("endpointsTitulo")}</SectionTitle>
        <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{rico(t("endpointsLegenda"))}</p>
        <Barras
          total={videos.length}
          itens={Object.entries(endpoints).map(([k, n]) => ({
            chave: k,
            rotulo: k === "geral" ? t("endpointGeral") : t("endpointCategoria", { id: k }),
            valor: n,
          }))}
        />
      </section>

      {nC > 0 && (
        <>
          <div className="grid gap-12 lg:grid-cols-2">
            <section>
              <SectionTitle as="h3">{t("eixoA")}</SectionTitle>
              <Barras total={nC} itens={Object.entries(contA).map(([k, n]) => ({ chave: k, rotulo: nomeProdutor(k, locale), valor: n }))} />
            </section>
            <section>
              <SectionTitle as="h3" tone="secondary">{t("eixoB")}</SectionTitle>
              <Barras cor="roxo" total={nC} itens={Object.entries(contB).map(([k, n]) => ({ chave: k, rotulo: nomeConteudo(k, locale), valor: n }))} />
            </section>
          </div>
          <section>
            <SectionTitle as="h3">{t("cruzamentoTitulo")}</SectionTitle>
            <p className="-mt-2 mb-6 text-sm text-muted-foreground">{t("cruzamentoLegenda")}</p>
            <MapaCalor
              linhas={PRODUTORES.filter((p) => cruz[p.codigo]).map((p) => ({ chave: p.codigo, rotulo: p.nome[locale] }))}
              colunas={CONTEUDOS.filter((c) => Object.values(cruz).some((l) => l[c.codigo])).map((c) => ({ chave: c.codigo, rotulo: c.nome[locale] }))}
              valores={cruz}
            />
          </section>
        </>
      )}

      <section>
        <SectionTitle as="h3">{t("videosTitulo")}</SectionTitle>
        <div className="max-h-[36rem] overflow-auto rounded-xl border border-cc-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-cc-surface text-left">
              <tr>
                {["colPos", "colCanal", "colTitulo", "colProdutor", "colConteudo", "colViews", "colEngajamento", "colDuracao", "colEndpoint"].map((c) => (
                  <th key={c} className="label-caps px-3 py-3 whitespace-nowrap text-muted-foreground">{t(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => {
                const views = v.visualizacoes ?? 0;
                const eng = views > 0 ? (((v.likes ?? 0) + (v.comentarios ?? 0)) / views) * 100 : null;
                return (
                  <tr key={v.id} className="border-t border-cc-line align-top">
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{v.posicao_ranking}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{v.canal_nome}</td>
                    <td className="min-w-64 px-3 py-2">
                      <a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer" className="hover:text-cc-green hover:underline">
                        {v.titulo}
                      </a>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {ehClassificado(v.tipo_produtor, "A") ? nomeProdutor(v.tipo_produtor!, locale) : <span className="text-muted-foreground">{t("naoClassificado")}</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {ehClassificado(v.tipo_conteudo, "B") ? nomeConteudo(v.tipo_conteudo!, locale) : <span className="text-muted-foreground">{t("naoClassificado")}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{format.number(views)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eng === null ? "—" : `${format.number(eng, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.duracao_segundos ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.categoria_coleta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function AbaSerie({ snapshots, agregados, locale }: { snapshots: Snapshot[]; agregados: Agregados; locale: Locale }) {
  const t = await getTranslations("Termometro");
  const format = await getFormatter();
  const cronologico = [...snapshots].sort((a, b) => a.data_coleta.localeCompare(b.data_coleta));
  const rotulo = (s: Snapshot) => format.dateTime(new Date(s.data_coleta), { dateStyle: "short", timeStyle: "short" });

  const classificados = cronologico.filter((s) => (agregados.porSnapshot.get(s.id)?.classificados ?? 0) > 0);
  const serieDe = (eixo: "produtor" | "conteudo", codigo: string) =>
    classificados.map((s) => {
      const a = agregados.porSnapshot.get(s.id)!;
      return { rotulo: rotulo(s), valor: ((a[eixo][codigo] ?? 0) / a.classificados) * 100, n: a.classificados };
    });

  const comFormato = cronologico.filter((s) => {
    const a = agregados.porSnapshot.get(s.id);
    return a && a.shorts + a.longos > 0;
  });
  const serieShorts = comFormato.map((s) => {
    const a = agregados.porSnapshot.get(s.id)!;
    return { rotulo: rotulo(s), valor: (a.shorts / (a.shorts + a.longos)) * 100 };
  });
  const intervalo = (lista: Snapshot[]) =>
    lista.length ? t("coletasNoGrafico", { n: lista.length, de: rotulo(lista[0]), ate: rotulo(lista.at(-1)!) }) : "";

  return (
    <div className="space-y-14">
      <section>
        <SectionTitle as="h3">{t("serieTitulo")}</SectionTitle>
        <p className="-mt-2 max-w-prose text-sm text-muted-foreground">{t("serieLegenda")} {t("serieAmostraPequena", { n: N_MINIMO })}</p>
        {classificados.length < 2 && (
          <div className="mt-6"><Aviso tom="importante">{t("serieInsuficiente", { n: classificados.length })}</Aviso></div>
        )}
      </section>

      {classificados.length >= 2 && (
        <>
          <section>
            <h4 className="mb-1 font-display text-lg">{t("serieA")}</h4>
            <p className="mb-4 text-xs text-muted-foreground">{intervalo(classificados)}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PRODUTORES.map((p) => <MiniSerie key={p.codigo} titulo={p.nome[locale]} pontos={serieDe("produtor", p.codigo)} />)}
            </div>
          </section>
          <section>
            <h4 className="mb-1 font-display text-lg">{t("serieB")}</h4>
            <p className="mb-4 text-xs text-muted-foreground">{intervalo(classificados)}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CONTEUDOS.map((c) => <MiniSerie key={c.codigo} cor="roxo" titulo={c.nome[locale]} pontos={serieDe("conteudo", c.codigo)} />)}
            </div>
          </section>
        </>
      )}

      {serieShorts.length >= 2 && (
        <section>
          <h4 className="mb-1 font-display text-lg">{t("serieShorts")}</h4>
          <p className="mb-4 text-xs text-muted-foreground">{t("serieShortsLegenda")} {intervalo(comFormato)}</p>
          <MiniSerie titulo={t("pctShorts")} pontos={serieShorts} />
        </section>
      )}
    </div>
  );
}

async function AbaCanais({ agregados, locale }: { agregados: Agregados; locale: Locale }) {
  const t = await getTranslations("Termometro");
  const format = await getFormatter();
  const top = agregados.canais.slice(0, 30);
  const max = Math.max(1, ...top.map((c) => c.aparicoes));
  return (
    <section>
      <SectionTitle as="h3">{t("canaisTitulo")}</SectionTitle>
      <p className="-mt-2 mb-6 max-w-prose text-sm text-muted-foreground">{t("canaisLegenda", { n: format.number(agregados.totalVideos) })}</p>
      <ol className="space-y-2.5">
        {top.map((c, i) => (
          <li key={c.canal_id} className="grid grid-cols-[2rem_minmax(8rem,16rem)_1fr_auto] items-center gap-3 text-sm" title={`${c.canal_nome}: ${c.aparicoes} ${t("aparicoes")}`}>
            <span className="tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0">
              <a href={`https://www.youtube.com/channel/${c.canal_id}`} target="_blank" rel="noopener noreferrer" className="block truncate hover:text-cc-green hover:underline">
                {c.canal_nome}
              </a>
              <span className="block truncate text-xs text-muted-foreground">
                {ehClassificado(c.tipo_produtor, "A") ? nomeProdutor(c.tipo_produtor, locale) : t("naoClassificado")}
              </span>
            </span>
            <span aria-hidden className="h-3 rounded-r-sm bg-cc-surface-2">
              <span className="block h-full rounded-r-sm bg-cc-green" style={{ width: `${(c.aparicoes / max) * 100}%` }} />
            </span>
            <span className="tabular-nums">{format.number(c.aparicoes)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function AbaExportar({ agregados }: { agregados: Agregados }) {
  const t = await getTranslations("Termometro");
  const format = await getFormatter();
  return (
    <section className="max-w-prose">
      <SectionTitle as="h3">{t("exportarTitulo")}</SectionTitle>
      <p className="text-muted-foreground">{t("exportarTexto", { n: format.number(agregados.totalVideos) })}</p>
      <Button asChild size="lg" className="mt-6">
        <a href="/api/termometro/csv" download>
          <Download aria-hidden /> {t("baixarCsv")}
        </a>
      </Button>
      <p className="mt-6 text-sm text-muted-foreground">{rico(t("exportarPublico"))}</p>
    </section>
  );
}
