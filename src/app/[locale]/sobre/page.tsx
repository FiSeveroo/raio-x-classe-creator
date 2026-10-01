import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { BrandBlock, Eyebrow } from "@/components/brand/Brand";
import { Logo } from "@/components/brand/Logo";
import { Pagina, Secao } from "@/components/pagina";
import { Paragrafos } from "@/components/rico";
import { Button } from "@/components/ui/button";

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
          <Button asChild variant="outline" size="sm" font="caps">
            <a href={href} target="_blank" rel="noopener noreferrer">
              {rotulo} <ArrowUpRight aria-hidden />
            </a>
          </Button>
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
      <Eyebrow className="mb-6">{t("rotulo")}</Eyebrow>
      <h1 className="font-display text-[clamp(3rem,10vw,8rem)] leading-[0.85]">
        {t("titulo1")} <span className="text-cc-green">{t("titulo2")}</span>
      </h1>

      <Secao numero="01" id="projeto" titulo={t("projetoTitulo")}>
        <Paragrafos textos={t.raw("projetoTexto") as string[]} className="prosa text-lg" />
      </Secao>

      <Secao numero="02" id="observatorio" titulo={t("observatorioTitulo")}>
        <Paragrafos textos={t.raw("observatorioTexto") as string[]} className="prosa text-lg" />
      </Secao>

      <BrandBlock className="mt-20 grid gap-10 px-6 py-14 sm:mt-28 sm:px-12 sm:py-16 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <div>
          <Logo className="h-16 sm:h-20" />
          <p className="mt-8 font-display text-3xl leading-[0.95] sm:text-4xl">{t("tagline")}</p>
        </div>
        <section aria-labelledby="movimento">
          <p id="movimento" className="label-caps mb-4 text-white/80">
            {t("movimentoTitulo")}
          </p>
          <Paragrafos textos={t.raw("movimentoTexto") as string[]} className="space-y-4 text-lg leading-relaxed text-white/90" />
          <Links
            itens={[
              { rotulo: t("linkSite"), href: "https://classecreator.com/" },
              { rotulo: t("linkInstagram"), href: "https://www.instagram.com/classecreator/" },
              { rotulo: t("linkYoutube"), href: "https://www.youtube.com/@ClasseCreator" },
            ]}
          />
        </section>
      </BrandBlock>

      <Secao numero="03" id="quem" titulo={t("quemTitulo")}>
        <p className="text-lg font-semibold">
          {t("quemNome")} <span className="font-normal text-muted-foreground">— {t("quemPapel")}</span>
        </p>
        <Paragrafos textos={t.raw("quemTexto") as string[]} className="prosa mt-4 text-lg" />
        <Links
          itens={[
            { rotulo: t("linkYoutube"), href: "https://www.youtube.com/@FilipeSevero" },
            { rotulo: t("linkInstagram"), href: "https://www.instagram.com/severo_filipe/" },
          ]}
        />
      </Secao>
    </Pagina>
  );
}
