import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase SOMENTE LEITURA (publishable key), usado em Server Components.
 *
 * Até a virada de produção, o app Next.js não grava no banco — ver CLAUDE.md
 * ("OBRIGATÓRIO antes de aplicar a migração"). Não criar aqui um cliente com
 * SUPABASE_SECRET_KEY sem essa decisão.
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
