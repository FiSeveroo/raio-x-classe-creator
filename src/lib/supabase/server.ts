import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase do servidor, com a PUBLISHABLE key (a mesma do Streamlit).
 *
 * As políticas (RLS) do banco permitem leitura pública e as gravações que o
 * Streamlit já fazia com essa chave (ex.: classificacoes_video na Lupa). A
 * SECRET key não é usada pelo site — ela fica só com o coletor Python.
 *
 * Gravações acontecem apenas em src/lib/lupa/registro.ts (e nos módulos
 * futuros), sempre com o versionamento canônico do db.py. Ver CLAUDE.md,
 * "Gravação no banco durante a migração".
 *
 * Retorna null se as credenciais não estiverem configuradas: as páginas
 * mostram "sem dados" em vez de quebrar (princípio 1 do CLAUDE.md).
 */
let cliente: SupabaseClient | null | undefined;

export function supabaseLeitura(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;

  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;

  cliente =
    url && chave
      ? createClient(url, chave, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  return cliente;
}

/** Mesmo cliente; nome separado só para deixar explícito onde se grava. */
export const supabaseGravacao = supabaseLeitura;
