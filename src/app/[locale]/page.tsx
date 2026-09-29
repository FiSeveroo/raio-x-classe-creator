import { ArrowRight } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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

const COR_MODULO: Record<ChaveModulo, string> = {
  lupa: "border-verde",
  termometro: "border-laranja",
  disputa: "border-roxo",
  dossie: "border-roxo",
  voz: "border-verde",
};

function ListaTipologia({
  categorias,
  locale,
  cor,
}: {
  categorias: Categoria[];
  locale: Locale;
  cor: "verde" | "roxo";
}) {
  return (
    <Accordion multiple className="rounded-md border border-border bg-superficie px-4">
      {categorias.map((c) => (
        <AccordionItem key={c.codigo} value={c.codigo}>
          <AccordionTrigger className="py-3 text-base">
            <span className="flex items-baseline gap-3">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 translate-y-[-2px] rounded-full", cor === "verde" ? "bg-verde" : "bg-roxo")}
              />
              {c.nome[locale]}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pl-5 text-sm leading-relaxed text-foreground/80">
            <p>{rico(c.definicao[locale])}</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{c.codigo}</p>
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
  const concluidas = tRaiz.raw("Concluidas") as PesquisaConcluida[];
  const faq = tRaiz.raw("Faq") as ItemFaq[];
  const privacidade = tRaiz.raw("Privacidade") as string[];

  return (
    <Pagina>
      {/* HERO */}
      <header>
        <p className="rotulo mb-4">{t("heroRotulo")}</p>
        <h1 className="text-5xl leading-[0.95] font-black uppercase sm:text-7xl">
          {t("heroTitulo1")}
          <br />
          <span className="text-verde">{t("heroTitulo2")}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground/80">
          {t("heroTexto")}
        </p>
      </header>

      <div className="mt-10 space-y-3">
        <Contadores valores={contadores} namespace="Home.contadores" />
        {contadores === null && <Aviso>{tc("semBanco")}</Aviso>}
      </div>

      {/* 01 — O QUE FAZ */}
      <Secao numero="01" id="o-que-faz" titulo={t("oQueFazTitulo")}>
        <Paragrafos textos={t.raw("oQueFazTexto") as string[]} />
      </Secao>

      {/* 02 — MÓDULOS */}
      <Secao numero="02" id="modulos" titulo={t("modulosTitulo")}>
        <p className="mb-8 max-w-prose text-muted-foreground">{t("modulosTexto")}</p>
        <ul className="grid gap-4 md:grid-cols-2">
          {MODULOS.map(({ chave, href, icone: Icone }) => (
            <li
              key={chave}
              className={cn("flex flex-col rounded-md border-l-2 bg-superficie p-5", COR_MODULO[chave])}
            >
              <div className="flex items-start gap-3">
                <Icone aria-hidden className="mt-1 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <h3 className="text-xl font-bold uppercase">{tm(`${chave}.nome`)}</h3>
                  <p className="rotulo mt-1 text-[0.65rem] tracking-[0.12em]">{tm(`${chave}.escala`)}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/85">{tm(`${chave}.frase`)}</p>

              <details className="group mt-4 text-sm">
                <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">+ </span>
                  <span className="hidden group-open:inline">− </span>
                  {t("quandoUsar")} · {t("casosDeUso")}
                </summary>
                <div className="mt-3 space-y-3 leading-relaxed text-foreground/80">
                  <p>
                    <strong className="text-foreground">{t("quandoUsar")}:</strong> {tm(`${chave}.quandoUsar`)}
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {(tm.raw(`${chave}.casos`) as string[]).map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              </details>

              <Link
                href={href}
                className="mt-auto inline-flex items-center gap-1.5 self-start pt-5 font-mono text-xs uppercase tracking-wider text-verde hover:underline"
              >
                {t("abrirModulo")} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Secao>

      {/* 03 — METODOLOGIA */}
      <Secao numero="03" id="metodologia" titulo={t("metodologiaTitulo")}>
        <p className="prosa mb-8">{t("metodologiaTexto")}</p>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="font-mono text-sm font-bold tracking-wider text-verde">{t("eixoA")}</p>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("eixoAPergunta")} · {t("categorias", { n: PRODUTORES.length })}
            </p>
            <ListaTipologia categorias={PRODUTORES} locale={locale} cor="verde" />
          </div>
          <div>
            <p className="font-mono text-sm font-bold tracking-wider text-roxo-texto">{t("eixoB")}</p>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("eixoBPergunta")} · {t("categorias", { n: CONTEUDOS.length })}
            </p>
            <ListaTipologia categorias={CONTEUDOS} locale={locale} cor="roxo" />
          </div>
        </div>
      </Secao>

      {/* 04 — BIBLIOTECA */}
      <Secao numero="04" id="biblioteca" titulo={t("bibliotecaTitulo")}>
        <p className="prosa">{rico(t("bibliotecaTexto"))}</p>
        <div className="mt-8 grid gap-6 rounded-md border-l-2 border-verde bg-gradient-to-br from-verde/[0.06] to-transparent p-6 md:grid-cols-[2fr_1fr]">
          <div>
            <h3 className="text-lg font-bold uppercase">{t("bibliotecaCardTitulo")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">{t("bibliotecaCardTexto")}</p>
            <Link
              href="/biblioteca"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-verde px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-background transition-opacity hover:opacity-85"
            >
              {t("bibliotecaBotao")} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-verde">{t("bibliotecaSnapshotRotulo")}</strong> {t("bibliotecaSnapshotTexto")}
          </p>
        </div>
      </Secao>

      {/* 05 — AGENDA */}
      <Secao numero="05" id="agenda" titulo={t("agendaTitulo")}>
        <p className="prosa mb-6">{rico(t("agendaTexto"))}</p>
        <Accordion className="border-y border-border">
          {agenda.map((p, i) => (
            <AccordionItem key={p.titulo} value={`agenda-${i}`}>
              <AccordionTrigger className="gap-4 py-4 text-base hover:no-underline">
                <span className="flex gap-4">
                  <span className="font-mono text-sm text-muted-foreground tabular-nums">
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{p.titulo}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pl-11 text-sm leading-relaxed text-foreground/80">
                <p className="rotulo text-[0.65rem] tracking-[0.12em]">
                  {p.modulos.map((m) => tm(`${m}.nome`)).join(" · ")}
                </p>
                <p>
                  <strong className="text-foreground">{t("agendaPergunta")}:</strong> {p.pergunta}
                </p>
                <p>
                  <strong className="text-foreground">{t("agendaHipotese")}:</strong> {p.hipotese}
                </p>
                <p>
                  <strong className="text-foreground">{t("agendaMetodo")}:</strong> {p.metodo}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Accordion className="mt-8 rounded-md bg-superficie px-5">
          <AccordionItem value="concluidas">
            <AccordionTrigger className="py-4 text-base font-bold">{t("concluidasTitulo")}</AccordionTrigger>
            <AccordionContent className="space-y-6 text-sm leading-relaxed text-foreground/80">
              <p>{t("concluidasTexto")}</p>
              {concluidas.map((p) => (
                <article key={p.titulo} className="border-t border-border pt-4">
                  <p className="rotulo text-[0.65rem]">
                    {p.tipo} · {p.ano}
                  </p>
                  <h3 className="mt-2 font-sans text-base font-semibold normal-case tracking-normal text-foreground">
                    {p.titulo}
                  </h3>
                  <p className="mt-1 italic text-muted-foreground">
                    {p.autor} — {p.instituicao} · {p.programa}
                  </p>
                  <p className="mt-3">
                    <strong className="text-foreground">{t("concluidasResumo")}:</strong> {p.resumo}
                  </p>
                  <p className="mt-3 font-semibold text-foreground">{t("concluidasAchados")}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {p.achados.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Secao>

      {/* 06 — COMO CITAR */}
      <Secao numero="06" id="citar" titulo={t("citarTitulo")}>
        <p className="prosa mb-6">{t("citarTexto")}</p>
        {(
          [
            ["citarFundadora", "fundadora"],
            ["citarFerramenta", "ferramenta"],
          ] as const
        ).map(([rotulo, chave]) => {
          // raw: a citação ABNT tem "<https://…>", que o ICU leria como tag.
          const texto = tRaiz.raw(`Citacoes.${chave}`) as string;
          return (
            <figure key={chave} className="mb-4 rounded-md bg-superficie">
              <figcaption className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="rotulo text-[0.65rem] tracking-[0.12em]">{t(rotulo)}</span>
                <BotaoCopiar texto={texto} rotulo={t("copiar")} rotuloCopiado={t("copiado")} />
              </figcaption>
              <p className="px-4 py-4 font-mono text-xs leading-relaxed break-words text-foreground/85 select-all">
                {texto}
              </p>
            </figure>
          );
        })}
      </Secao>

      {/* 07 — FAQ + PRIVACIDADE */}
      <Secao numero="07" id="faq" titulo={t("faqTitulo")}>
        <Accordion className="border-y border-border">
          {faq.map((f, i) => (
            <AccordionItem key={f.pergunta} value={`faq-${i}`}>
              <AccordionTrigger className="py-4 text-base">{f.pergunta}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-foreground/80">
                <p>{rico(f.resposta)}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
          <AccordionItem value="privacidade">
            <AccordionTrigger className="py-4 text-base">{t("privacidadeTitulo")}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-foreground/80">
              <Paragrafos textos={privacidade} className="space-y-3" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Secao>

      {/* 08 — CONTRIBUIR */}
      <Secao numero="08" id="contribuir" titulo={t("contribuirTitulo")}>
        <Paragrafos textos={t.raw("contribuirTexto") as string[]} />
      </Secao>

      <footer className="mt-20 border-t border-border pt-6 text-center font-mono text-xs text-muted-foreground">
        {tc("rodape")}
      </footer>
    </Pagina>
  );
}
