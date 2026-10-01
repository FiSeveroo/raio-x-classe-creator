import { painelLiberado } from "@/app/[locale]/termometro/acoes";
import { supabaseLeitura } from "@/lib/supabase/server";

/*
 * Exportação do corpus do Termômetro em CSV — porte da aba "Exportar" do
 * app.py, com o corpus INTEIRO (o Streamlit exportava só as 1.000 linhas
 * mais recentes). Mesmo formato: todas as colunas de videos_snapshot +
 * data_coleta e semana_ano do snapshot. Restrito como o painel.
 */

export const maxDuration = 120;

const PAGINA = 1000;

function celula(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await painelLiberado())) return new Response("Acesso restrito.", { status: 403 });
  const db = supabaseLeitura();
  if (!db) return new Response("Banco não configurado.", { status: 503 });

  const encoder = new TextEncoder();
  let pagina = 0;
  let colunas: string[] | null = null;

  const corpo = new ReadableStream<Uint8Array>({
    async pull(controle) {
      const { data, error } = await db
        .from("videos_snapshot")
        .select("*, snapshots(data_coleta, semana_ano)")
        .order("id")
        .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
      if (error) {
        controle.error(new Error(error.message));
        return;
      }
      const linhas = (data ?? []).map((r) => {
        const { snapshots, ...resto } = r as Record<string, unknown> & { snapshots?: { data_coleta?: string; semana_ano?: number } };
        return { ...resto, data_coleta: snapshots?.data_coleta ?? null, semana_ano: snapshots?.semana_ano ?? null };
      });
      if (!colunas && linhas.length) {
        colunas = Object.keys(linhas[0]);
        controle.enqueue(encoder.encode("﻿" + colunas.join(",") + "\n")); // BOM para o Excel ler UTF-8
      }
      for (const l of linhas) {
        controle.enqueue(encoder.encode(colunas!.map((c) => celula((l as Record<string, unknown>)[c])).join(",") + "\n"));
      }
      pagina++;
      if (linhas.length < PAGINA) controle.close();
    },
  });

  const hoje = new Date().toISOString().slice(0, 10);
  return new Response(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="raio-x-corpus-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
