"use client";

import { Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type LinhaTabela = {
  id: number;
  /** Texto usado pela busca (minúsculas, já concatenado no servidor). */
  busca: string;
  /** Valor para o filtro de seleção, se houver. */
  filtro?: string;
  /** Link da análise completa (null = ainda não disponível nesta versão). */
  href: string | null;
  celulas: ReactNode[];
};

export function TabelaFiltravel({
  colunas,
  linhas,
  rotuloBusca,
  filtro,
}: {
  colunas: { rotulo: string; className?: string }[];
  linhas: LinhaTabela[];
  rotuloBusca: string;
  filtro?: { rotulo: string; rotuloTodos: string; opcoes: { valor: string; rotulo: string }[] };
}) {
  const t = useTranslations("Biblioteca");
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [valorFiltro, setValorFiltro] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter(
      (l) =>
        (!termo || l.busca.includes(termo)) &&
        (!valorFiltro || l.filtro === valorFiltro),
    );
  }, [linhas, busca, valorFiltro]);

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="relative block">
          <span className="sr-only">{rotuloBusca}</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={rotuloBusca}
            className="h-10 pl-9"
          />
        </label>

        {filtro && (
          <label className="block">
            <span className="sr-only">{filtro.rotulo}</span>
            <select
              value={valorFiltro}
              onChange={(e) => setValorFiltro(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">
                {filtro.rotulo}: {filtro.rotuloTodos}
              </option>
              {filtro.opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="mb-3 font-mono text-xs text-muted-foreground" aria-live="polite">
        {t("mostrando", { n: filtradas.length, total: linhas.length })}
      </p>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {colunas.map((c) => (
                <TableHead key={c.rotulo} className={cn("font-mono text-[0.7rem] uppercase tracking-wider", c.className)}>
                  {c.rotulo}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((l) => (
              <TableRow
                key={l.id}
                // Linha inteira clicável quando há análise completa; o link real
                // fica na primeira célula para teclado e leitores de tela.
                onClick={l.href ? () => router.push(l.href!) : undefined}
                className={cn(l.href && "cursor-pointer")}
              >
                {l.celulas.map((c, i) => (
                  <TableCell key={i} className={cn("align-top", colunas[i]?.className)}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
