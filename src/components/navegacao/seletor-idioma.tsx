"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function SeletorIdioma() {
  const t = useTranslations("Nav");
  const localeAtual = useLocale();
  // Caminho sem o prefixo de idioma — mantém a página atual ao trocar.
  const pathname = usePathname();

  return (
    <div role="group" aria-label={t("idioma")} className="flex gap-1">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          hrefLang={locale}
          aria-current={locale === localeAtual ? "true" : undefined}
          className={cn(
            "label-caps rounded-md px-2 py-1 transition-colors",
            locale === localeAtual
              ? "bg-cc-surface-2 text-cc-green"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {locale}
        </Link>
      ))}
    </div>
  );
}
