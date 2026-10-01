import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Contadores } from "@/components/contadores";
import { Aviso, Pagina } from "@/components/pagina";
import {
  bibliotecaBuscas,
  bibliotecaComentarios,
  bibliotecaDossies,
  bibliotecaVideos,
  contadoresPublicos,
  type ResultadoConsulta,
} from "@/lib/corpus";
import { PRODUTORES, nomeConteudo, nomeProdutor } from "@/lib/tipologia";
import { cn } from "@/lib/utils";
import { TabelaFiltravel, type LinhaTabela } from "./tabela-filtravel";

const ABAS = ["videos", "canais", "temas", "voz"] as const;
type Aba = (typeof ABAS)[number];

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/biblioteca">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Biblioteca" });
  return { title: t("titulo"), description: t("subtitulo") };
}

const truncar = (s: string | null | undefined, n: number) => {
  const v = s ?? "";
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};

export default async function Biblioteca({
  params,
  searchParams,
}: PageProps<"/[locale]/biblioteca">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { aba: abaParam } = await searchParams;
  const aba: Aba = ABAS.includes(abaParam as Aba) ? (abaParam as Aba) : "videos";

  const t = await getTranslations("Biblioteca");
  const tc = await getTranslations("Comum");
  const format = await getFormatter();
  const data = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "—";
  const col = (k: string) => t(`colunas.${k}`);

  const contadores = await contadoresPublicos();

  let conteudo: React.ReactNode;

  function falha(r: ResultadoConsulta<unknown>) {
    if (r.status === "sem_banco") return <Aviso>{tc("semBanco")}</Aviso>;
    if (r.status === "erro") return <Aviso tom="erro">{tc("erroConsulta", { erro: r.mensagem })}</Aviso>;
    return null;
  }

  if (aba === "videos") {
    const r = await bibliotecaVideos();
    if (r.status !== "ok") conteudo = falha(r);
    else if (r.dados.length === 0) conteudo = <Aviso>{t("videos.vazio")}</Aviso>;
    else {
      const linhas: LinhaTabela[] = r.dados.map((v) => ({
        id: v.id,
        busca: `${v.titulo ?? ""} ${v.canal_nome ?? ""}`.toLowerCase(),
        filtro: v.tipo_produtor,
        href: `/biblioteca/video/${v.id}`,
        celulas: [
          <span key="d" className="text-xs tabular-nums text-muted-foreground">{data(v.data_classificacao)}</span>,
          truncar(v.canal_nome, 60),
          <Link key="t" href={`/biblioteca/video/${v.id}`} className="hover:text-cc-green hover:underline">
            {truncar(v.titulo, 80)}
          </Link>,
          <span key="p" className="text-cc-green">{nomeProdutor(v.tipo_produtor, locale)}</span>,
          <span key="c" className="text-cc-purple-text">{nomeConteudo(v.tipo_conteudo, locale)}</span>,
          <span key="v" className="text-xs">v{v.versao_numero ?? 1}</span>,
        ],
      }));
      const presentes = new Set(r.dados.map((v) => v.tipo_produtor));
      conteudo = (
        <TabelaFiltravel
          linhas={linhas}
          rotuloBusca={t("videos.busca")}
          filtro={{
            rotulo: t("videos.filtro"),
            rotuloTodos: t("todos"),
            opcoes: PRODUTORES.filter((p) => presentes.has(p.codigo)).map((p) => ({
              valor: p.codigo,
              rotulo: p.nome[locale],
            })),
          }}
          colunas={[
            { rotulo: col("data"), className: "w-24" },
            { rotulo: col("canal"), className: "hidden md:table-cell" },
            { rotulo: col("titulo"), className: "min-w-56 whitespace-normal" },
            { rotulo: col("produtor") },
            { rotulo: col("conteudo"), className: "hidden sm:table-cell" },
            { rotulo: col("versao"), className: "w-16" },
          ]}
        />
      );
    }
  } else if (aba === "canais") {
    const r = await bibliotecaDossies();
    if (r.status !== "ok") conteudo = falha(r);
    else if (r.dados.length === 0) conteudo = <Aviso>{t("canais.vazio")}</Aviso>;
    else {
      const presentes = new Set(r.dados.map((d) => d.classificacao_sociologica));
      conteudo = (
        <TabelaFiltravel
          linhas={r.dados.map((d) => ({
            id: d.id,
            busca: (d.canal_nome ?? "").toLowerCase(),
            filtro: d.classificacao_sociologica,
            href: `/biblioteca/canal/${d.id}`,
            celulas: [
              <span key="d" className="text-xs tabular-nums text-muted-foreground">{data(d.data_dossie)}</span>,
              <Link key="n" href={`/biblioteca/canal/${d.id}`} className="hover:text-cc-green hover:underline">{truncar(d.canal_nome, 60)}</Link>,
              <span key="i" className="text-xs tabular-nums">{d.inscritos == null ? "—" : format.number(d.inscritos)}</span>,
              <span key="p" className="text-cc-green">{nomeProdutor(d.classificacao_sociologica, locale)}</span>,
              <span key="c" className="text-cc-purple-text">{nomeConteudo(d.tipo_conteudo_predominante, locale)}</span>,
              <span key="v" className="text-xs">v{d.versao_numero ?? 1}</span>,
            ],
          }))}
          rotuloBusca={t("canais.busca")}
          filtro={{
            rotulo: t("canais.filtro"),
            rotuloTodos: t("todas"),
            opcoes: PRODUTORES.filter((p) => presentes.has(p.codigo)).map((p) => ({
              valor: p.codigo,
              rotulo: p.nome[locale],
            })),
          }}
          colunas={[
            { rotulo: col("data"), className: "w-24" },
            { rotulo: col("canal"), className: "min-w-40 whitespace-normal" },
            { rotulo: col("inscritos"), className: "hidden sm:table-cell" },
            { rotulo: col("classe") },
            { rotulo: col("conteudo"), className: "hidden md:table-cell" },
            { rotulo: col("versao"), className: "w-16" },
          ]}
        />
      );
    }
  } else if (aba === "temas") {
    const r = await bibliotecaBuscas();
    if (r.status !== "ok") conteudo = falha(r);
    else if (r.dados.length === 0) conteudo = <Aviso>{t("temas.vazio")}</Aviso>;
    else
      conteudo = (
        <TabelaFiltravel
          linhas={r.dados.map((b) => ({
            id: b.id,
            busca: (b.termo_buscado ?? "").toLowerCase(),
            href: null,
            celulas: [
              <span key="d" className="text-xs tabular-nums text-muted-foreground">{data(b.data_busca)}</span>,
              truncar(b.termo_buscado, 80),
              <span key="n" className="text-xs tabular-nums">{b.total_analisados ?? "—"}</span>,
              <span key="v" className="text-xs">v{b.versao_numero ?? 1}</span>,
            ],
          }))}
          rotuloBusca={t("temas.busca")}
          colunas={[
            { rotulo: col("data"), className: "w-24" },
            { rotulo: col("termo"), className: "min-w-48 whitespace-normal" },
            { rotulo: col("resultados") },
            { rotulo: col("versao"), className: "w-16" },
          ]}
        />
      );
  } else {
    const r = await bibliotecaComentarios();
    if (r.status !== "ok") conteudo = falha(r);
    else if (r.dados.length === 0) conteudo = <Aviso>{t("voz.vazio")}</Aviso>;
    else
      conteudo = (
        <TabelaFiltravel
          linhas={r.dados.map((c) => ({
            id: c.id,
            busca: `${c.canal_nome ?? ""} ${c.titulo_video ?? ""}`.toLowerCase(),
            href: null,
            celulas: [
              <span key="d" className="text-xs tabular-nums text-muted-foreground">{data(c.data_analise)}</span>,
              truncar(c.canal_nome, 50),
              truncar(c.titulo_video, 60),
              <span key="n" className="text-xs tabular-nums">{c.total_analisados ?? "—"}</span>,
              <span key="i" className="text-xs tabular-nums">
                {/* Mesmo formato do Streamlit: inteiro + % */}
                {c.indice_pressao_produtiva == null ? "—" : `${Math.round(Number(c.indice_pressao_produtiva))}%`}
              </span>,
              <span key="v" className="text-xs">v{c.versao_numero ?? 1}</span>,
            ],
          }))}
          rotuloBusca={t("voz.busca")}
          colunas={[
            { rotulo: col("data"), className: "w-24" },
            { rotulo: col("canal"), className: "hidden md:table-cell" },
            { rotulo: col("video"), className: "min-w-48 whitespace-normal" },
            { rotulo: col("comentarios"), className: "hidden sm:table-cell" },
            { rotulo: col("ipp") },
            { rotulo: col("versao"), className: "w-16" },
          ]}
        />
      );
  }

  return (
    <Pagina>
      <header>
        <h1 className="font-display text-[clamp(2.25rem,9vw,6.5rem)] leading-[0.9] [overflow-wrap:anywhere] hyphens-auto">{t("titulo")}</h1>
        <p className="label-caps text-muted-foreground mt-3">{t("subtitulo")}</p>
        <p className="prosa mt-6">{t("texto")}</p>
      </header>

      <div className="mt-8">
        <Contadores valores={contadores} namespace="Biblioteca.contadores" />
      </div>

      <nav aria-label={t("titulo")} className="mt-10 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-cc-line">
        {ABAS.map((a) => (
          <Link
            key={a}
            href={a === "videos" ? "/biblioteca" : { pathname: "/biblioteca", query: { aba: a } }}
            aria-current={a === aba ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-3 label-caps transition-colors",
              a === aba
                ? "border-cc-green text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`abas.${a}`)}
          </Link>
        ))}
      </nav>

      <section className="mt-8" aria-labelledby="aba-titulo">
        <h2 id="aba-titulo" className="font-display text-2xl text-cc-green">
          {t(`${aba}.titulo`)}
        </h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{t(`${aba}.legenda`)}</p>
        {aba !== "videos" && (
          <p className="mb-4 text-xs text-muted-foreground">{t("detalheEmMigracao")}</p>
        )}
        {conteudo}
      </section>
    </Pagina>
  );
}
