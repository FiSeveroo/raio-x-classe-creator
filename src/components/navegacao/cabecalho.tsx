"use client";

import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { MODULOS } from "@/lib/navegacao";
import { cn } from "@/lib/utils";
import { SeletorIdioma } from "./seletor-idioma";

function Marca() {
  const t = useTranslations("Nav");
  return (
    <Link href="/" className="group flex items-baseline gap-3" aria-label={`${t("marca")} — ${t("home")}`}>
      <span className="font-heading text-2xl font-black tracking-wider text-verde">{t("marca")}</span>
      <span className="rotulo hidden text-[0.6rem] tracking-[0.18em] group-hover:text-foreground sm:inline">
        Classe Creator
      </span>
    </Link>
  );
}

/** Lista dos 5 módulos — usada no painel do desktop e no menu mobile. */
function ListaModulos({ aoNavegar, compacta }: { aoNavegar: () => void; compacta?: boolean }) {
  const tm = useTranslations("Modulos");
  const pathname = usePathname();
  return (
    <ul className={cn("grid", compacta ? "gap-1" : "gap-px bg-border sm:grid-cols-2 lg:grid-cols-5")}>
      {MODULOS.map(({ chave, href, icone: Icone }, i) => {
        const ativo = pathname === href;
        return (
          <li key={chave} className={compacta ? "" : "bg-background"}>
            <Link
              href={href}
              onClick={aoNavegar}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "group flex h-full flex-col transition-colors",
                compacta ? "flex-row items-center gap-4 py-3" : "gap-3 p-5 hover:bg-superficie",
              )}
            >
              <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
                <Icone aria-hidden className="size-4" />
              </span>
              <span className={cn("font-heading font-black uppercase", compacta ? "text-2xl" : "text-lg", ativo ? "text-verde" : "group-hover:text-verde")}>
                {tm(`${chave}.nome`)}
              </span>
              {!compacta && (
                <>
                  <span className="rotulo text-[0.6rem] tracking-[0.12em]">{tm(`${chave}.escala`)}</span>
                  <span className="line-clamp-3 text-sm leading-snug text-foreground/70">{tm(`${chave}.frase`)}</span>
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Cabecalho() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [painel, setPainel] = useState(false);
  const [mobile, setMobile] = useState(false);
  const idPainel = useId();
  const raiz = useRef<HTMLElement>(null);

  // Fecha painel/menu ao trocar de página (inclusive pelo "voltar" do navegador).
  const [rotaAnterior, setRotaAnterior] = useState(pathname);
  if (rotaAnterior !== pathname) {
    setRotaAnterior(pathname);
    setPainel(false);
    setMobile(false);
  }

  // ...e com Esc ou clique fora.
  useEffect(() => {
    if (!painel && !mobile) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setPainel(false), setMobile(false));
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setPainel(false);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", fora);
    document.body.style.overflow = mobile ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("mousedown", fora);
      document.body.style.overflow = "";
    };
  }, [painel, mobile]);

  const linkTopo = (href: string, rotulo: string) => {
    const ativo = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        aria-current={ativo ? "page" : undefined}
        className={cn(
          "font-mono text-xs uppercase tracking-wider transition-colors hover:text-foreground",
          ativo ? "text-verde" : "text-foreground/70",
        )}
      >
        {rotulo}
      </Link>
    );
  };

  const moduloAtivo = MODULOS.some((m) => pathname === m.href);

  return (
    <header ref={raiz} className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-8">
        <Marca />

        {/* Desktop */}
        <nav aria-label={t("menu")} className="hidden items-center gap-8 md:flex">
          <button
            type="button"
            aria-expanded={painel}
            aria-controls={idPainel}
            onClick={() => setPainel((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider transition-colors hover:text-foreground",
              moduloAtivo || painel ? "text-verde" : "text-foreground/70",
            )}
          >
            {t("secaoModulos")}
            <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", painel && "rotate-180")} />
          </button>
          {linkTopo("/biblioteca", t("biblioteca"))}
          {linkTopo("/sobre", t("sobre"))}
          <span aria-hidden className="h-4 w-px bg-border" />
          <SeletorIdioma />
        </nav>

        {/* Mobile */}
        <button
          type="button"
          aria-expanded={mobile}
          aria-label={mobile ? t("fecharMenu") : t("abrirMenu")}
          onClick={() => setMobile((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-md hover:bg-superficie-2 md:hidden"
        >
          {mobile ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </div>

      {/* Painel de módulos (desktop) */}
      <div
        id={idPainel}
        hidden={!painel}
        className="absolute inset-x-0 top-full hidden border-b border-border bg-background shadow-2xl shadow-black md:block"
      >
        <div className="mx-auto max-w-7xl">
          <ListaModulos aoNavegar={() => setPainel(false)} />
        </div>
      </div>

      {/* Menu em tela cheia (mobile) */}
      {mobile && (
        <div className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto bg-background px-4 pt-6 pb-10 md:hidden">
          <p className="rotulo mb-2">{t("secaoModulos")}</p>
          <ListaModulos compacta aoNavegar={() => setMobile(false)} />
          <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
            {[
              ["/biblioteca", t("biblioteca")],
              ["/sobre", t("sobre")],
            ].map(([href, rotulo]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobile(false)}
                className="flex items-center justify-between font-heading text-2xl font-black uppercase hover:text-verde"
              >
                {rotulo} <ArrowUpRight aria-hidden className="size-5 text-muted-foreground" />
              </Link>
            ))}
          </div>
          <div className="mt-10">
            <SeletorIdioma />
          </div>
        </div>
      )}
    </header>
  );
}
