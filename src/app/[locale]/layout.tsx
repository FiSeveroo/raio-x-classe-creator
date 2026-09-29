import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ConteudoMenu } from "@/components/navegacao/menu-lateral";
import { BarraMobile } from "@/components/navegacao/barra-mobile";
import { dmSans, gunterz, spaceMono } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Só os idiomas de generateStaticParams existem. Sem isso, /favicon.ico e
// afins caem aqui como se "favicon.ico" fosse um idioma.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://raiox.classecreator.com";

  return {
    metadataBase: new URL(base),
    title: { default: t("titulo"), template: `%s · ${t("titulo")}` },
    description: t("descricao"),
    openGraph: {
      type: "website",
      siteName: t("titulo"),
      locale: { pt: "pt_BR", en: "en_US", es: "es_ES" }[locale],
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default async function LayoutLocale({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("Nav");

  return (
    <html
      lang={locale === "pt" ? "pt-BR" : locale}
      className={`${gunterz.variable} ${dmSans.variable} ${spaceMono.variable}`}
    >
      <body className="min-h-dvh">
        <NextIntlClientProvider>
          <a
            href="#conteudo"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-verde focus:px-3 focus:py-2 focus:text-background"
          >
            {t("pularParaConteudo")}
          </a>

          <BarraMobile />

          <div className="lg:flex">
            <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-8 lg:block">
              <ConteudoMenu />
            </aside>

            <main id="conteudo" className="min-w-0 flex-1">
              {children}
            </main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
