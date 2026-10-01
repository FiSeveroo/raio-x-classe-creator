"use client";

import { Download, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type ComentarioClassificado = {
  id?: string;
  autor?: string;
  texto?: string;
  likes?: number;
  data?: string;
  respostas?: number;
  dimensoes?: unknown;
};

/** Mesmo teto do Streamlit: 50 na tela, o conjunto completo no CSV. */
const NA_TELA = 50;

function celulaCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  // pandas.to_csv escreve listas pelo repr do Python: ['a', 'b']
  const s = Array.isArray(v) ? `[${v.map((x) => `'${String(x)}'`).join(", ")}]` : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Lista filtrável por dimensão + exportação CSV (porte do bloco "Comentários classificados"). */
export function Comentarios({
  comentarios,
  dimensoes,
  arquivoCsv,
}: {
  comentarios: ComentarioClassificado[];
  /** Código → nome traduzido, na ordem de DIMENSOES_VOZ. */
  dimensoes: { codigo: string; nome: string }[];
  arquivoCsv: string;
}) {
  const t = useTranslations("VozResultado");
  const [filtro, setFiltro] = useState("");
  const nomes = Object.fromEntries(dimensoes.map((d) => [d.codigo, d.nome]));
  const dimsDe = (c: ComentarioClassificado) => (Array.isArray(c.dimensoes) ? (c.dimensoes as string[]) : []);
  const filtrados = filtro ? comentarios.filter((c) => dimsDe(c).includes(filtro)) : comentarios;

  function baixar() {
    const colunas = [...new Set(comentarios.flatMap((c) => Object.keys(c)))];
    const linhas = [colunas.join(","), ...comentarios.map((c) => colunas.map((k) => celulaCsv((c as Record<string, unknown>)[k])).join(","))];
    const blob = new Blob(["﻿" + linhas.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = arquivoCsv;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="sr-only">{t("filtro")}</span>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">{t("filtro")}: {t("todas")}</option>
            {dimensoes.map((d) => (
              <option key={d.codigo} value={d.codigo}>{d.nome}</option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={baixar} className="h-10">
          <Download aria-hidden /> {t("baixarCsv")}
        </Button>
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-lg bg-cc-surface px-4 py-3 text-sm text-muted-foreground">{t("nenhum")}</p>
      ) : (
        <>
          <ul className="space-y-2" lang="pt-BR">
            {filtrados.slice(0, NA_TELA).map((c, i) => (
              <li key={c.id ?? i} className="rounded-lg border-l-2 border-cc-line bg-cc-surface px-4 py-3">
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <ThumbsUp aria-hidden className="size-3" /> {c.likes ?? 0}
                  </span>
                  {/* O YouTube já devolve o handle com "@"; o Streamlit prefixava outro ("@@nome"). */}
                  <span className="[overflow-wrap:anywhere]">{(c.autor ?? "").startsWith("@") ? c.autor : `@${c.autor ?? ""}`}</span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                  {Array.from(c.texto ?? "").slice(0, 600).join("")}
                </p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {dimsDe(c).filter((d) => d in nomes).length === 0 ? (
                    <span className="text-xs text-muted-foreground/70">{t("semDimensao")}</span>
                  ) : (
                    dimsDe(c)
                      .filter((d) => d in nomes)
                      .map((d) => (
                        <span key={d} className="rounded-sm bg-cc-purple/40 px-2 py-0.5 text-xs text-foreground">
                          {nomes[d]}
                        </span>
                      ))
                  )}
                </p>
              </li>
            ))}
          </ul>
          {filtrados.length > NA_TELA && (
            <p className="mt-3 text-xs text-muted-foreground">{t("mostrando", { n: NA_TELA, total: filtrados.length })}</p>
          )}
        </>
      )}
    </div>
  );
}
