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

type Ordem = "numero" | "mais_curtidos" | "menos_curtidos";

function celulaCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  // pandas.to_csv escreve listas pelo repr do Python: ['a', 'b']
  const s = Array.isArray(v) ? `[${v.map((x) => `'${String(x)}'`).join(", ")}]` : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Lista filtrável por dimensão + exportação CSV (porte do bloco "Comentários
 * classificados"). Cada comentário leva o número que o Sonnet recebeu ([1] a
 * [100], na ordem de relevância do YouTube na coleta), para achar os citados
 * na síntese. Diferença deliberada: o Streamlit mostrava só 50 e sem número.
 */
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
  const [ordem, setOrdem] = useState<Ordem>("numero");
  const nomes = Object.fromEntries(dimensoes.map((d) => [d.codigo, d.nome]));
  const dimsDe = (c: ComentarioClassificado) => (Array.isArray(c.dimensoes) ? (c.dimensoes as string[]) : []);
  const numerados = comentarios.map((c, i) => ({ c, n: i + 1 }));
  const filtrados = (filtro ? numerados.filter(({ c }) => dimsDe(c).includes(filtro)) : numerados).slice();
  if (ordem === "mais_curtidos") filtrados.sort((a, b) => (b.c.likes ?? 0) - (a.c.likes ?? 0) || a.n - b.n);
  if (ordem === "menos_curtidos") filtrados.sort((a, b) => (a.c.likes ?? 0) - (b.c.likes ?? 0) || a.n - b.n);

  function baixar() {
    const colunas = [...new Set(comentarios.flatMap((c) => Object.keys(c)))];
    const linhas = [
      ["numero", ...colunas].join(","),
      ...comentarios.map((c, i) => [String(i + 1), ...colunas.map((k) => celulaCsv((c as Record<string, unknown>)[k]))].join(",")),
    ];
    const blob = new Blob(["﻿" + linhas.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = arquivoCsv;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
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
        <label className="block">
          <span className="sr-only">{t("ordenar")}</span>
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
            className="h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="numero">{t("ordenar")}: {t("ordemNumero")}</option>
            <option value="mais_curtidos">{t("ordenar")}: {t("ordemMaisCurtidos")}</option>
            <option value="menos_curtidos">{t("ordenar")}: {t("ordemMenosCurtidos")}</option>
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
            {filtrados.map(({ c, n }) => (
              <li key={c.id ?? n} id={`comentario-${n}`} className="rounded-lg border-l-2 border-cc-line bg-cc-surface px-4 py-3">
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground tabular-nums" aria-label={t("numero", { n })}>#{n}</span>
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
        </>
      )}
    </div>
  );
}
