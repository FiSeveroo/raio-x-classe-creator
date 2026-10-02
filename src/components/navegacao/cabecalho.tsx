"use client";

import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { MODULOS } from "@/lib/navegacao";
import { cn } from "@/lib/utils";
import { IndicadorSessao } from "@/components/sessao/botao-sessao";
import { SeletorIdioma } from "./seletor-idioma";

/** Logo oficial + nome do produto. */
function Marca() {
  const t = useTranslations("Nav");
  return (
    <Link href="/" className="flex items-center gap-3" aria-label={`Raio-X — ${t("home")}`}>
      <Logo className="h-9" priority />
      <span className="font-display text-xl leading-none text-foreground">Raio-X</span>
    </Link>
  );
}

/** Lista dos 5 módulos — usada no painel do desktop e no menu mobile. */
function ListaModulos({ aoNavegar, compacta }: { aoNavegar: () => void; compacta?: boolean }) {
  const tm = useTranslations("Modulos");
  const pathname = usePathname();
  return (
    <ul className={cn("grid", compacta ? "gap-1" : "gap-px bg-cc-line sm:grid-cols-2 lg:grid-cols-5")}>
      {MODULOS.map(({ chave, href, icone: Icone }, i) => {
        const ativo = pathname === href;
        return (
          <li key={chave} className={compacta ? "" : "bg-cc-bg"}>
            <Link
              href={href}
              onClick={aoNavegar}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "group flex h-full transition-colors",
                compacta ? "items-center gap-4 py-3" : "flex-col gap-3 p-5 hover:bg-cc-surface",
              )}
            >
              <span className="label-caps flex items-center gap-2 text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
                <Icone aria-hidden className="size-4" />
              </span>
              <span
                className={cn(
                  "font-display",
                  compacta ? "text-2xl" : "text-lg leading-tight",
                  ativo ? "text-cc-green" : "group-hover:text-cc-green",
                )}
              >
                {tm(`${chave}.nome`)}
              </span>
              {!compacta && (
                <>
                  <span className="label-caps text-muted-foreground">{tm(`${chave}.escala`)}</span>
                  <span className="line-clamp-3 text-sm leading-snug text-muted-foreground">{tm(`${chave}.frase`)}</span>
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
        className={cn("label-caps transition-colors hover:text-foreground", ativo ? "text-cc-green" : "text-muted-foreground")}
      >
        {rotulo}
      </Link>
    );
  };

  const moduloAtivo = MODULOS.some((m) => pathname === m.href);

  return (
    <header ref={raiz} className="sticky top-0 z-40 border-b border-cc-line/70">
      {/* Desfoque numa camada própria: backdrop-filter no <header> faria o menu
          mobile (position: fixed) se posicionar dentro do cabeçalho, não da tela. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-cc-bg/85 backdrop-blur" />
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
              "label-caps flex items-center gap-1.5 transition-colors hover:text-foreground",
              moduloAtivo || painel ? "text-cc-green" : "text-muted-foreground",
            )}
          >
            {t("secaoModulos")}
            <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", painel && "rotate-180")} />
          </button>
          {linkTopo("/biblioteca", t("biblioteca"))}
          {linkTopo("/sobre", t("sobre"))}
          <IndicadorSessao />
          <span aria-hidden className="h-4 w-px bg-cc-line" />
          <SeletorIdioma />
        </nav>

        {/* Mobile */}
        <div className="flex items-center gap-4 md:hidden">
          <IndicadorSessao />
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={mobile}
          aria-label={mobile ? t("fecharMenu") : t("abrirMenu")}
          onClick={() => setMobile((v) => !v)}
          className="md:hidden"
        >
          {mobile ? <X aria-hidden /> : <Menu aria-hidden />}
        </Button>
        </div>
      </div>

      {/* Painel de módulos (desktop) */}
      <div
        id={idPainel}
        hidden={!painel}
        className="absolute inset-x-0 top-full hidden border-b border-cc-line bg-cc-bg shadow-2xl shadow-black md:block"
      >
        <div className="mx-auto max-w-7xl">
          <ListaModulos aoNavegar={() => setPainel(false)} />
        </div>
      </div>

      {/* Menu em tela cheia (mobile) */}
      {mobile && (
        <div className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto bg-cc-bg px-4 pt-6 pb-10 md:hidden">
          <p className="label-caps mb-2 text-muted-foreground">{t("secaoModulos")}</p>
          <ListaModulos compacta aoNavegar={() => setMobile(false)} />
          <div className="mt-8 flex flex-col gap-4 border-t border-cc-line pt-6">
            {[
              ["/biblioteca", t("biblioteca")],
              ["/sobre", t("sobre")],
            ].map(([href, rotulo]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobile(false)}
                className="flex items-center justify-between font-display text-2xl hover:text-cc-green"
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
