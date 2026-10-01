import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BotaoCopiar } from "@/components/botao-copiar";
import { Contadores } from "@/components/contadores";
import { Aviso, estiloBotao, Pagina, Secao } from "@/components/pagina";
import { Paragrafos, rico } from "@/components/rico";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { contadoresPublicos } from "@/lib/corpus";
import { MODULOS, type ChaveModulo } from "@/lib/navegacao";
import { CONTEUDOS, PRODUTORES, type Categoria } from "@/lib/tipologia";
import { cn } from "@/lib/utils";

// Contadores do corpus: recalculados a cada 5 minutos.
export const revalidate = 300;

type ItemAgenda = {
  modulos: ChaveModulo[];
  titulo: string;
  pergunta: string;
  hipotese: string;
  metodo: string;
};
type PesquisaConcluida = {
  tipo: string;
  autor: string;
  titulo: string;
  ano: number;
  instituicao: string;
  programa: string;
  resumo: string;
  achados: string[];
};
type ItemFaq = { pergunta: string; resposta: string };

function ListaTipologia({ categorias, locale }: { categorias: Categoria[]; locale: Locale }) {
  return (
    <Accordion multiple className="border-t border-border">
      {categorias.map((c, i) => (
        <AccordionItem key={c.codigo} value={c.codigo} className="border-b border-border">
          <AccordionTrigger className="rounded-none py-4 text-base hover:no-underline">
            <span className="flex items-baseline gap-4">
              <span className="w-6 font-mono text-xs text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-semibold">{c.nome[locale]}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pl-10 text-sm leading-relaxed text-foreground/80">
            <p>{rico(c.definicao[locale])}</p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">{c.codigo}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const tm = await getTranslations("Modulos");
  const tc = await getTranslations("Comum");
  const tRaiz = await getTranslations();

  const contadores = await contadoresPublicos();
  const agenda = tRaiz.raw("Agenda") as ItemAgenda[];
  const [fundadora] = tRaiz.raw("Concluidas") as PesquisaConcluida[];
  const faq = tRaiz.raw("Faq") as ItemFaq[];
  const privacidade = tRaiz.raw("Privacidade") as string[];

  return (
    <>
      {/* ───────────── HERO ───────────── */}
      <Pagina className="pb-0 lg:pt-24">
        <p className="rotulo mb-6">{t("heroRotulo")}</p>
        <h1 className="text-[clamp(3.25rem,12vw,10.5rem)] leading-[0.85] font-black uppercase">
          {t("heroTitulo1")}
          <br />
          <span className="text-verde">{t("heroTitulo2")}</span>
        </h1>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/85 sm:text-xl">{t("heroTexto")}</p>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row lg:justify-end">
            <Link href="/lupa" className={cn(estiloBotao.base, estiloBotao.laranja)}>
              {t("ctaLupa")} <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="/biblioteca" className={cn(estiloBotao.base, estiloBotao.contorno)}>
              {t("ctaBiblioteca")}
            </Link>
          </div>
        </div>

        <div className="mt-20">
          <p className="rotulo mb-4">{t("corpusRotulo")}</p>
          <Contadores valores={contadores} namespace="Home.contadores" />
          {contadores === null && (
            <div className="mt-3">
              <Aviso>{tc("semBanco")}</Aviso>
            </div>
          )}
        </div>
      </Pagina>

      {/* ───────────── BLOCO ROXO: AS DUAS PERGUNTAS ───────────── */}
      <section aria-labelledby="perguntas" className="mt-24 bg-roxo sm:mt-32">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 sm:py-28">
          <p className="mb-10 font-mono text-xs uppercase tracking-[0.2em] text-foreground/80">
            {t("perguntasRotulo")}
          </p>
          <h2 id="perguntas" className="sr-only">
            {t("oQueFazTitulo")}
          </h2>
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            {(
              [
                ["eixoA", "eixoAPergunta"],
                ["eixoB", "eixoBPergunta"],
              ] as const
            ).map(([eixo, pergunta]) => (
              <div key={eixo}>
                <p className="font-mono text-sm tracking-[0.14em] text-foreground/80">{t(eixo)}</p>
                <p className="mt-4 font-heading text-4xl leading-[0.95] font-black uppercase sm:text-6xl">
                  {t(pergunta)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-16 grid gap-6 border-t border-foreground/25 pt-10 text-base leading-relaxed text-foreground/90 md:grid-cols-3">
            {(t.raw("oQueFazTexto") as string[]).map((p, i) => (
              <p key={i}>{rico(p)}</p>
            ))}
          </div>
        </div>
      </section>

      <Pagina className="pt-0 lg:pt-0">
        {/* ───────────── 01 MÓDULOS ───────────── */}
        <Secao numero="01" id="modulos" titulo={t("modulosTitulo")}>
          <p className="mb-10 max-w-prose text-lg text-foreground/75">{t("modulosTexto")}</p>
          <ol className="border-t border-border">
            {MODULOS.map(({ chave, href }, i) => (
              <li key={chave} className="border-b border-border">
                <Link
                  href={href}
                  className="group grid items-baseline gap-x-8 gap-y-2 px-1 py-7 transition-colors hover:bg-superficie sm:px-4 md:grid-cols-[3rem_1.1fr_1.4fr_auto]"
                >
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block font-heading text-3xl leading-none font-black uppercase transition-colors group-hover:text-verde sm:text-4xl">
                      {tm(`${chave}.nome`)}
                    </span>
                    <span className="rotulo mt-2 block text-[0.62rem] tracking-[0.12em]">{tm(`${chave}.escala`)}</span>
                  </span>
                  <span className="text-sm leading-relaxed text-foreground/75">{tm(`${chave}.frase`)}</span>
                  <ArrowRight
                    aria-hidden
                    className="hidden size-6 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-verde md:block"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </Secao>

        {/* ───────────── 02 METODOLOGIA ───────────── */}
        <Secao numero="02" id="metodologia" titulo={t("metodologiaTitulo")}>
          <p className="prosa mb-12 text-lg">{t("metodologiaTexto")}</p>
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <div className="mb-4 border-l-4 border-verde pl-4">
                <p className="font-mono text-sm font-bold tracking-wider text-verde">{t("eixoA")}</p>
                <p className="text-sm text-muted-foreground">{t("categorias", { n: PRODUTORES.length })}</p>
              </div>
              <ListaTipologia categorias={PRODUTORES} locale={locale} />
            </div>
            <div>
              <div className="mb-4 border-l-4 border-roxo pl-4">
                <p className="font-mono text-sm font-bold tracking-wider text-roxo-texto">{t("eixoB")}</p>
                <p className="text-sm text-muted-foreground">{t("categorias", { n: CONTEUDOS.length })}</p>
              </div>
              <ListaTipologia categorias={CONTEUDOS} locale={locale} />
            </div>
          </div>
        </Secao>

        {/* ───────────── BIBLIOTECA ───────────── */}
        <section
          aria-labelledby="biblioteca-titulo"
          className="mt-24 grid gap-10 bg-superficie p-8 sm:mt-32 sm:p-12 lg:grid-cols-[1.3fr_1fr]"
        >
          <div>
            <p className="rotulo mb-4">{t("bibliotecaTitulo")}</p>
            <h2 id="biblioteca-titulo" className="text-3xl leading-none font-black uppercase sm:text-4xl">
              {t("bibliotecaCardTitulo")}
            </h2>
            <p className="mt-6 max-w-prose leading-relaxed text-foreground/80">{rico(t("bibliotecaTexto"))}</p>
            <Link href="/biblioteca" className={cn(estiloBotao.base, estiloBotao.verde, "mt-8")}>
              {t("bibliotecaBotao")} <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="space-y-6 border-t border-border pt-6 text-sm leading-relaxed text-foreground/70 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
            <p>{t("bibliotecaCardTexto")}</p>
            <p>
              <strong className="text-foreground">{t("bibliotecaSnapshotRotulo")}</strong>{" "}
              {t("bibliotecaSnapshotTexto")}
            </p>
          </div>
        </section>

        {/* ───────────── 03 AGENDA ───────────── */}
        <Secao numero="03" id="agenda" titulo={t("agendaTitulo")}>
          <p className="prosa mb-12 text-lg">{rico(t("agendaTexto"))}</p>
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {agenda.map((p, i) => (
              <details key={p.titulo} className="group bg-background p-6 open:bg-superficie">
                <summary className="flex cursor-pointer list-none flex-col gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      #{String(i + 1).padStart(2, "0")} · {p.modulos.map((m) => tm(`${m}.nome`)).join(" · ")}
                    </span>
                    <span aria-hidden className="font-mono text-lg text-verde group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </span>
                  <span className="text-lg leading-snug font-semibold">{p.titulo}</span>
                </summary>
                <dl className="mt-5 space-y-4 text-sm leading-relaxed text-foreground/80">
                  {(
                    [
                      ["agendaPergunta", p.pergunta],
                      ["agendaHipotese", p.hipotese],
                      ["agendaMetodo", p.metodo],
                    ] as const
                  ).map(([rotulo, texto]) => (
                    <div key={rotulo}>
                      <dt className="rotulo mb-1 text-[0.62rem]">{t(rotulo)}</dt>
                      <dd>{texto}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
          </div>

          {/* Pesquisa fundadora */}
          <article className="mt-16 grid gap-10 border-l-4 border-verde pl-6 sm:pl-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="rotulo">
                {t("concluidasTitulo")} · {fundadora.tipo} · {fundadora.ano}
              </p>
              <h3 className="mt-4 font-sans text-2xl leading-tight font-semibold tracking-normal normal-case">
                {fundadora.titulo}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {fundadora.autor} — {fundadora.instituicao} · {fundadora.programa}
              </p>
              <p className="mt-6 leading-relaxed text-foreground/80">{fundadora.resumo}</p>
            </div>
            <div>
              <p className="rotulo mb-4">{t("concluidasAchados")}</p>
              <ul className="space-y-3">
                {fundadora.achados.map((a) => (
                  <li key={a} className="flex gap-3 text-sm leading-relaxed">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-verde" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </Secao>

        {/* ───────────── 04 COMO CITAR ───────────── */}
        <Secao numero="04" id="citar" titulo={t("citarTitulo")}>
          <p className="prosa mb-10 text-lg">{t("citarTexto")}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                ["citarFundadora", "fundadora"],
                ["citarFerramenta", "ferramenta"],
              ] as const
            ).map(([rotulo, chave]) => {
              // raw: a citação ABNT tem "<https://…>", que o ICU leria como tag.
              const texto = tRaiz.raw(`Citacoes.${chave}`) as string;
              return (
                <figure key={chave} className="flex flex-col bg-superficie">
                  <figcaption className="flex items-center justify-between border-b border-border px-5 py-3">
                    <span className="rotulo text-[0.62rem] tracking-[0.12em]">{t(rotulo)}</span>
                    <BotaoCopiar texto={texto} rotulo={t("copiar")} rotuloCopiado={t("copiado")} />
                  </figcaption>
                  <p className="px-5 py-5 font-mono text-xs leading-relaxed break-words text-foreground/85 select-all">
                    {texto}
                  </p>
                </figure>
              );
            })}
          </div>
        </Secao>

        {/* ───────────── 05 FAQ ───────────── */}
        <Secao numero="05" id="faq" titulo={t("faqTitulo")}>
          <Accordion className="border-t border-border">
            {faq.map((f, i) => (
              <AccordionItem key={f.pergunta} value={`faq-${i}`} className="border-b border-border">
                <AccordionTrigger className="rounded-none py-5 text-lg hover:no-underline">{f.pergunta}</AccordionTrigger>
                <AccordionContent className="max-w-prose pb-6 text-base leading-relaxed text-foreground/80">
                  <p>{rico(f.resposta)}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
            <AccordionItem value="privacidade" className="border-b border-border">
              <AccordionTrigger className="rounded-none py-5 text-lg hover:no-underline">
                {t("privacidadeTitulo")}
              </AccordionTrigger>
              <AccordionContent className="max-w-prose pb-6 text-base leading-relaxed text-foreground/80">
                <Paragrafos textos={privacidade} className="space-y-3" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Secao>

        {/* ───────────── CONTRIBUIR ───────────── */}
        <section aria-labelledby="contribuir" className="mt-24 grid gap-8 sm:mt-32 lg:grid-cols-[1fr_1.4fr]">
          <h2 id="contribuir" className="text-3xl leading-none font-black uppercase sm:text-4xl">
            {t("contribuirTitulo")}
          </h2>
          <div>
            <Paragrafos textos={t.raw("contribuirTexto") as string[]} className="prosa text-lg" />
            <Link
              href="/sobre"
              className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-verde hover:underline"
            >
              {tRaiz("Nav.sobre")} <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </section>
      </Pagina>
    </>
  );
}
