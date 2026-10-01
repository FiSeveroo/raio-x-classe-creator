"use client";

import { ChevronDown, Download, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ResultadoBusca } from "@/lib/corpus";

const TIPOS = ["video", "channel", "playlist"] as const;

function urlDoItem(r: ResultadoBusca): string | null {
  if (!r.item_id) return null;
  const id = encodeURIComponent(r.item_id);
  if (r.tipo_item === "video") return `https://www.youtube.com/watch?v=${id}`;
  if (r.tipo_item === "channel") return `https://www.youtube.com/channel/${id}`;
  return `https://www.youtube.com/playlist?list=${id}`;
}

function celulaCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Ranking com filtros (tipo de item, tipo de produtor), justificativa por
 * item e exportação CSV — porte do bloco "Ranking dos resultados" do app.py.
 */
export function Ranking({
  itens,
  nomesProdutor,
  nomesConteudo,
  arquivoCsv,
}: {
  itens: ResultadoBusca[];
  nomesProdutor: Record<string, string>;
  nomesConteudo: Record<string, string>;
  arquivoCsv: string;
}) {
  const t = useTranslations("DisputaResultado");
  const [tipo, setTipo] = useState("");
  const [produtor, setProdutor] = useState("");
  const produtores = useMemo(() => [...new Set(itens.map((i) => i.tipo_produtor))].sort(), [itens]);
  const filtrados = itens.filter((i) => (!tipo || i.tipo_item === tipo) && (!produtor || i.tipo_produtor === produtor));

  function baixar() {
    const colunas = Object.keys(itens[0] ?? {});
    const linhas = [colunas.join(","), ...itens.map((r) => colunas.map((c) => celulaCsv((r as Record<string, unknown>)[c])).join(","))];
    const blob = new Blob(["﻿" + linhas.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = arquivoCsv;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const seletor = "h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="sr-only">{t("filtroTipo")}</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={seletor}>
            <option value="">{t("filtroTipo")}: {t("todos")}</option>
            {TIPOS.map((x) => (
              <option key={x} value={x}>{t(`tipos.${x}`)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">{t("filtroProdutor")}</span>
          <select value={produtor} onChange={(e) => setProdutor(e.target.value)} className={seletor}>
            <option value="">{t("filtroProdutor")}: {t("todos")}</option>
            {produtores.map((p) => (
              <option key={p} value={p}>{nomesProdutor[p] ?? p}</option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={baixar} className="h-10">
          <Download aria-hidden /> {t("baixarCsv")}
        </Button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
        {t("mostrando", { n: filtrados.length, total: itens.length })}
      </p>

      <ol className="divide-y divide-cc-line rounded-xl border border-cc-line">
        {filtrados.map((r) => {
          const url = urlDoItem(r);
          return (
            <li key={r.id}>
              <details className="group">
                <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_1fr_auto] items-start gap-3 px-4 py-3 hover:bg-cc-surface [&::-webkit-details-marker]:hidden">
                  <span className="pt-0.5 font-display text-lg tabular-nums text-muted-foreground">{r.posicao_ranking}</span>
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{r.titulo}</span>
                    <span className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                      <span className="label-caps text-muted-foreground">{t(`tipos.${r.tipo_item}`)}</span>
                      {r.tipo_item !== "channel" && r.canal_nome && <span className="text-muted-foreground">{r.canal_nome}</span>}
                      <span className="text-cc-green">{nomesProdutor[r.tipo_produtor] ?? r.tipo_produtor}</span>
                      <span className="text-cc-purple-text">{nomesConteudo[r.tipo_conteudo] ?? r.tipo_conteudo}</span>
                    </span>
                  </span>
                  <ChevronDown aria-hidden className="mt-1 size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-3 px-4 pb-4 pl-[4.25rem] text-sm">
                  <p>
                    <span className="label-caps mr-2 text-muted-foreground">{t("justificativa")}</span>
                    <span lang="pt-BR" className="leading-relaxed">{r.justificativa}</span>
                  </p>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-cc-green hover:underline">
                      {t("abrirNoYoutube")} <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
