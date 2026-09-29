import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { Pagina, Secao } from "@/components/pagina";
import { Paragrafos } from "@/components/rico";

export async function generateMetadata({ params }: PageProps<"/[locale]/sobre">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Nav" });
  return { title: t("sobre") };
}

function Links({ itens }: { itens: { rotulo: string; href: string }[] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-3">
      {itens.map(({ rotulo, href }) => (
        <li key={href}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-foreground/80 transition-colors hover:border-verde hover:text-verde"
          >
            {rotulo} <ExternalLink className="size-3" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function Sobre({ params }: PageProps<"/[locale]/sobre">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Sobre");

  return (
    <Pagina>
      <header>
        <p className="rotulo mb-4">{t("rotulo")}</p>
        <h1 className="text-5xl leading-[0.95] font-black uppercase sm:text-7xl">
          {t("titulo1")}
          <br />
          <span className="text-verde">{t("titulo2")}</span>
        </h1>
      </header>

      <Secao numero="01" id="projeto" titulo={t("projetoTitulo")}>
        <Paragrafos textos={t.raw("projetoTexto") as string[]} />
      </Secao>

      <Secao numero="02" id="observatorio" titulo={t("observatorioTitulo")}>
        <Paragrafos textos={t.raw("observatorioTexto") as string[]} />
      </Secao>

      <Secao numero="03" id="movimento" titulo={t("movimentoTitulo")}>
        <Paragrafos textos={t.raw("movimentoTexto") as string[]} />
        <p className="mt-6 font-heading text-2xl font-bold uppercase text-verde">{t("tagline")}</p>
        <Links
          itens={[
            { rotulo: t("linkSite"), href: "https://classecreator.com/" },
            { rotulo: t("linkInstagram"), href: "https://www.instagram.com/classecreator/" },
            { rotulo: t("linkYoutube"), href: "https://www.youtube.com/@ClasseCreator" },
          ]}
        />
      </Secao>

      <Secao numero="04" id="quem" titulo={t("quemTitulo")}>
        <p className="text-lg font-semibold">
          {t("quemNome")} <span className="font-normal text-muted-foreground">— {t("quemPapel")}</span>
        </p>
        <Paragrafos textos={t.raw("quemTexto") as string[]} className="prosa mt-4" />
        <Links
          itens={[
            { rotulo: t("linkYoutube"), href: "https://www.youtube.com/@FilipeSevero" },
            { rotulo: t("linkInstagram"), href: "https://www.instagram.com/severo_filipe/" },
          ]}
        />
      </Secao>

      <footer className="mt-20 border-t border-border pt-6 font-mono text-xs text-muted-foreground">
        {t("rodape")}
      </footer>
    </Pagina>
  );
}
