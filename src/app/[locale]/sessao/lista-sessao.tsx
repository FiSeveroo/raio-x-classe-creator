"use client";

import { Download, Loader2, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { limparSessao, removerDaSessao, useSessao, type ModuloSessao } from "@/lib/sessao/carrinho";

const DESTINO: Record<ModuloSessao, string> = {
  lupa: "/biblioteca/video/",
  disputa: "/biblioteca/tema/",
  dossie: "/biblioteca/canal/",
  voz: "/biblioteca/voz/",
};
const ORDEM: ModuloSessao[] = ["lupa", "disputa", "dossie", "voz"];

export function ListaSessao({ nomes }: { nomes: Record<ModuloSessao, string> }) {
  const t = useTranslations("Sessao");
  const itens = useSessao();
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar() {
    setBaixando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/sessao/xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens: itens.map(({ modulo, id }) => ({ modulo, id })) }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const nome = resp.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "raio-x-sessao.xlsx";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await resp.blob());
      a.download = nome;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBaixando(false);
    }
  }

  if (!itens.length) {
    return <p className="rounded-lg bg-cc-surface px-4 py-3 text-sm text-muted-foreground">{t("vazia")}</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" font="display" onClick={exportar} disabled={baixando}>
          {baixando ? <Loader2 aria-hidden className="animate-spin" /> : <Download aria-hidden />} {t("exportar")}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => limparSessao()} disabled={baixando}>
          <Trash2 aria-hidden /> {t("limpar")}
        </Button>
      </div>
      {erro && (
        <p role="alert" className="mt-4 rounded-lg border-l-2 border-cc-orange bg-cc-surface px-4 py-3 text-sm">
          {t("erro", { detalhe: erro })}
        </p>
      )}

      <div className="mt-10 space-y-8">
        {ORDEM.filter((m) => itens.some((i) => i.modulo === m)).map((m) => {
          const doModulo = itens.filter((i) => i.modulo === m);
          return (
            <section key={m}>
              <h2 className="font-display text-xl text-cc-purple-text">
                {nomes[m]} <span className="text-sm text-muted-foreground tabular-nums">({doModulo.length})</span>
              </h2>
              <ul className="mt-3 divide-y divide-cc-line rounded-xl border border-cc-line">
                {doModulo.map((i) => (
                  <li key={`${i.modulo}-${i.id}`} className="flex items-center gap-3 px-4 py-3">
                    <Link href={`${DESTINO[i.modulo]}${i.id}`} className="min-w-0 flex-1 [overflow-wrap:anywhere] hover:text-cc-green hover:underline">
                      {i.rotulo || `#${i.id}`}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removerDaSessao(i.modulo, i.id)}
                      aria-label={t("removerItem", { rotulo: i.rotulo || `#${i.id}` })}
                      className="rounded p-1 text-muted-foreground hover:bg-cc-surface-2 hover:text-foreground"
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
