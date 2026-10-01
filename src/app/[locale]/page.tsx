import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrandBlock, Eyebrow, SectionTitle } from "@/components/brand/Brand";
import { Logo } from "@/components/brand/Logo";
import { BotaoCopiar } from "@/components/botao-copiar";
import { Contadores } from "@/components/contadores";
import { Aviso, Pagina, Secao } from "@/components/pagina";
import { Paragrafos, rico } from "@/components/rico";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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
    <Accordion type="multiple" className="border-t border-cc-line">
      {categorias.map((c, i) => (
        <AccordionItem key={c.codigo} value={c.codigo} className="border-cc-line">
          <AccordionTrigger className="py-4 text-base hover:no-underline">
            <span className="flex items-baseline gap-4">
              <span className="w-6 text-xs text-muted-foreground tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-semibold">{c.nome[locale]}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pl-10 leading-relaxed text-muted-foreground">
            <p>{rico(c.definicao[locale])}</p>
            <p className="label-caps mt-3 normal-case tracking-normal">{c.codigo}</p>
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
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <Logo className="hidden h-16 sm:block" priority />
          <Eyebrow>{t("heroRotulo")}</Eyebrow>
        </div>
        <h1 className="mt-8 font-display text-[clamp(4rem,16vw,13rem)] leading-[0.85]">{t("heroTitulo1")}</h1>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/85 sm:text-xl">{t("heroTexto")}</p>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Button asChild variant="cta" size="lg" font="display">
              <Link href="/lupa">
                {t("ctaLupa")} <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/biblioteca">{t("ctaBiblioteca")}</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20">
          <Eyebrow className="mb-4">{t("corpusRotulo")}</Eyebrow>
          <Contadores valores={contadores} namespace="Home.contadores" />
          {contadores === null && (
            <div className="mt-3">
              <Aviso>{tc("semBanco")}</Aviso>
            </div>
          )}
        </div>

        {/* ───────────── BLOCO ROXO: AS DUAS PERGUNTAS ───────────── */}
        <BrandBlock className="mt-20 px-6 py-14 sm:mt-28 sm:px-12 sm:py-20">
          <section aria-labelledby="perguntas">
            <p className="label-caps mb-10 text-white/80">{t("perguntasRotulo")}</p>
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
                  <p className="label-caps text-white/80">{t(eixo)}</p>
                  <p className="mt-4 font-display text-4xl leading-[0.95] sm:text-6xl">{t(pergunta)}</p>
                </div>
              ))}
            </div>
            <div className="mt-14 grid gap-6 border-t border-white/25 pt-10 leading-relaxed text-white/90 md:grid-cols-3">
              {(t.raw("oQueFazTexto") as string[]).map((p, i) => (
                <p key={i}>{rico(p)}</p>
              ))}
            </div>
          </section>
        </BrandBlock>

        {/* ───────────── 01 MÓDULOS ───────────── */}
        <Secao numero="01" id="modulos" titulo={t("modulosTitulo")}>
          <p className="mb-10 max-w-prose text-lg text-muted-foreground">{t("modulosTexto")}</p>
          <ol className="border-t border-cc-line">
            {MODULOS.map(({ chave, href }, i) => (
              <li key={chave} className="border-b border-cc-line">
                <Link
                  href={href}
                  className="group grid items-baseline gap-x-8 gap-y-2 rounded-lg px-1 py-7 transition-colors hover:bg-cc-surface sm:px-4 md:grid-cols-[3rem_1.1fr_1.4fr_auto]"
                >
                  <span className="font-display text-lg text-cc-green">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="block font-display text-3xl leading-none transition-colors group-hover:text-cc-green sm:text-4xl">
                      {tm(`${chave}.nome`)}
                    </span>
                    <Eyebrow className="mt-2">{tm(`${chave}.escala`)}</Eyebrow>
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">{tm(`${chave}.frase`)}</span>
                  <ArrowRight
                    aria-hidden
                    className="hidden size-6 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-cc-green md:block"
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
              <SectionTitle as="h3" eyebrow={t("categorias", { n: PRODUTORES.length })}>
                {t("eixoA")}
              </SectionTitle>
              <ListaTipologia categorias={PRODUTORES} locale={locale} />
            </div>
            <div>
              <SectionTitle as="h3" tone="secondary" eyebrow={t("categorias", { n: CONTEUDOS.length })}>
                {t("eixoB")}
              </SectionTitle>
              <ListaTipologia categorias={CONTEUDOS} locale={locale} />
            </div>
          </div>
        </Secao>

        {/* ───────────── BIBLIOTECA ───────────── */}
        <section
          aria-labelledby="biblioteca-titulo"
          className="mt-20 grid gap-10 rounded-2xl border border-cc-line bg-cc-surface p-8 sm:mt-28 sm:p-12 lg:grid-cols-[1.3fr_1fr]"
        >
          <div>
            <Eyebrow className="mb-4">{t("bibliotecaTitulo")}</Eyebrow>
            <h2 id="biblioteca-titulo" className="font-display text-3xl leading-none sm:text-4xl">
              {t("bibliotecaCardTitulo")}
            </h2>
            <p className="mt-6 max-w-prose leading-relaxed text-muted-foreground">{rico(t("bibliotecaTexto"))}</p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/biblioteca">
                {t("bibliotecaBotao")} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="space-y-6 border-t border-cc-line pt-6 text-sm leading-relaxed text-muted-foreground lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
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
          <div className="grid gap-4 sm:grid-cols-2">
            {agenda.map((p, i) => (
              <details
                key={p.titulo}
                className="group rounded-xl border border-cc-line bg-cc-surface p-6 open:border-cc-green/50"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    <Eyebrow>
                      #{String(i + 1).padStart(2, "0")} · {p.modulos.map((m) => tm(`${m}.nome`)).join(" · ")}
                    </Eyebrow>
                    <span aria-hidden className="font-display text-xl text-cc-green transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                  <span className="text-lg leading-snug font-semibold">{p.titulo}</span>
                </summary>
                <dl className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
                  {(
                    [
                      ["agendaPergunta", p.pergunta],
                      ["agendaHipotese", p.hipotese],
                      ["agendaMetodo", p.metodo],
                    ] as const
                  ).map(([rotulo, texto]) => (
                    <div key={rotulo}>
                      <dt className="label-caps mb-1 text-cc-purple-text">{t(rotulo)}</dt>
                      <dd>{texto}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
          </div>

          {/* Pesquisa fundadora */}
          <article className="mt-16 grid gap-10 border-l-4 border-cc-green pl-6 sm:pl-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <Eyebrow>
                {t("concluidasTitulo")} · {fundadora.tipo} · {fundadora.ano}
              </Eyebrow>
              <h3 className="mt-4 text-2xl leading-tight font-semibold">{fundadora.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {fundadora.autor} — {fundadora.instituicao} · {fundadora.programa}
              </p>
              <p className="mt-6 leading-relaxed text-foreground/85">{fundadora.resumo}</p>
            </div>
            <div>
              <Eyebrow className="mb-4">{t("concluidasAchados")}</Eyebrow>
              <ul className="space-y-3">
                {fundadora.achados.map((a) => (
                  <li key={a} className="flex gap-3 text-sm leading-relaxed">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-cc-green" />
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
                <figure key={chave} className="flex flex-col rounded-xl border border-cc-line bg-cc-surface">
                  <figcaption className="flex items-center justify-between gap-2 border-b border-cc-line py-2 pr-2 pl-5">
                    <Eyebrow>{t(rotulo)}</Eyebrow>
                    <BotaoCopiar texto={texto} rotulo={t("copiar")} rotuloCopiado={t("copiado")} />
                  </figcaption>
                  <p className="px-5 py-5 text-sm leading-relaxed break-words text-foreground/85 select-all">{texto}</p>
                </figure>
              );
            })}
          </div>
        </Secao>

        {/* ───────────── 05 FAQ ───────────── */}
        <Secao numero="05" id="faq" titulo={t("faqTitulo")}>
          <Accordion type="single" collapsible className="border-t border-cc-line">
            {faq.map((f, i) => (
              <AccordionItem key={f.pergunta} value={`faq-${i}`} className="border-cc-line">
                <AccordionTrigger className="py-5 text-lg hover:no-underline">{f.pergunta}</AccordionTrigger>
                <AccordionContent className="max-w-prose pb-6 text-base leading-relaxed text-muted-foreground">
                  <p>{rico(f.resposta)}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
            <AccordionItem value="privacidade" className="border-cc-line">
              <AccordionTrigger className="py-5 text-lg hover:no-underline">{t("privacidadeTitulo")}</AccordionTrigger>
              <AccordionContent className="max-w-prose pb-6 text-base leading-relaxed text-muted-foreground">
                <Paragrafos textos={privacidade} className="space-y-3" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Secao>

        {/* ───────────── CONTRIBUIR ───────────── */}
        <section aria-labelledby="contribuir" className="mt-20 grid gap-8 sm:mt-28 lg:grid-cols-[1fr_1.4fr]">
          <SectionTitle tone="secondary" className="items-start">
            <span id="contribuir">{t("contribuirTitulo")}</span>
          </SectionTitle>
          <div>
            <Paragrafos textos={t.raw("contribuirTexto") as string[]} className={cn("prosa text-lg")} />
            <Button asChild variant="link" font="caps" className="mt-6 h-auto px-0 text-cc-green">
              <Link href="/sobre">
                {tRaiz("Nav.sobre")} <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </Pagina>
    </>
  );
}
