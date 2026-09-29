"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { MODULOS, PROJETO, type ItemNav } from "@/lib/navegacao";
import { cn } from "@/lib/utils";
import { SeletorIdioma } from "./seletor-idioma";

function ativo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function ListaNav({
  titulo,
  itens,
  aoNavegar,
}: {
  titulo: string;
  itens: ItemNav[];
  aoNavegar?: () => void;
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <div>
      <p className="rotulo mb-2 px-3 text-[0.65rem]">{titulo}</p>
      <ul className="space-y-0.5">
        {itens.map(({ chave, href, icone: Icone }) => {
          const eAtivo = ativo(pathname, href);
          return (
            <li key={chave}>
              <Link
                href={href}
                onClick={aoNavegar}
                aria-current={eAtivo ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
                  eAtivo
                    ? "border-verde bg-superficie-2 text-foreground"
                    : "border-transparent text-foreground/70 hover:bg-superficie hover:text-foreground",
                )}
              >
                <Icone
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    eAtivo ? "text-verde" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {t(chave)}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Conteúdo da navegação — usado na barra lateral (desktop) e no menu (mobile). */
export function ConteudoMenu({ aoNavegar }: { aoNavegar?: () => void }) {
  const t = useTranslations("Nav");

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={aoNavegar} className="block px-3 pb-6">
        <span className="font-heading text-3xl font-black tracking-wider text-verde">
          {t("marca")}
        </span>
        <span className="rotulo mt-1 block text-[0.6rem] tracking-[0.18em]">
          {t("observatorio")}
        </span>
      </Link>

      <nav aria-label={t("secaoModulos")} className="flex-1 space-y-6">
        <ListaNav titulo={t("secaoModulos")} itens={MODULOS} aoNavegar={aoNavegar} />
        <ListaNav titulo={t("secaoProjeto")} itens={PROJETO} aoNavegar={aoNavegar} />
      </nav>

      <div className="px-3 pt-6">
        <SeletorIdioma />
      </div>
    </div>
  );
}
