import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/Brand";
import { Aviso, Pagina } from "@/components/pagina";
import { rico } from "@/components/rico";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { contasLigadas, usuarioAtual } from "@/lib/supabase/conta";
import { humanoVerificado, turnstileSiteKey } from "@/lib/turnstile";
import { FormularioEntrar } from "./formulario";

export async function generateMetadata({ params }: PageProps<"/[locale]/entrar">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Entrar" });
  return { title: t("titulo"), robots: { index: false } };
}

export default async function Entrar({ params, searchParams }: PageProps<"/[locale]/entrar">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const sp = await searchParams;
  if (await usuarioAtual()) redirect({ href: "/conta", locale });
  const t = await getTranslations("Entrar");

  return (
    <Pagina>
      <Eyebrow className="mb-6">{t("eyebrow")}</Eyebrow>
      <h1 className="font-display text-[clamp(2.25rem,8vw,5.5rem)] leading-[0.9]">{t("titulo")}</h1>
      <p className="prosa mt-6 mb-10 max-w-prose text-lg">{rico(t("intro"))}</p>
      {sp.erro === "link" && (
        <div className="mb-6 max-w-md">
          <Aviso tom="erro">{t("erros.link")}</Aviso>
        </div>
      )}
      {contasLigadas() ? (
        <FormularioEntrar
          modoInicial={sp.criar ? "criar" : "link"}
          siteKeyTurnstile={turnstileSiteKey()}
          verificadoInicial={await humanoVerificado()}
        />
      ) : (
        <Aviso>{t("desligado")}</Aviso>
      )}
      <p className="mt-10 max-w-md text-sm text-muted-foreground">
        {t("privacidade")}{" "}
        <Link href="/privacidade" className="text-cc-green underline-offset-4 hover:underline">
          {t("privacidadeLink")}
        </Link>
      </p>
    </Pagina>
  );
}
