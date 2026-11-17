import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

/*
 * Clientes Supabase das contas (decisão do Filipe em 17/nov/2026).
 *
 * - clienteConta(): age COMO a pessoa logada (cookie de sessão + chave
 *   publicável). As políticas de RLS garantem que ela só vê o que é dela.
 * - clienteAdmin(): chave SECRETA, só no servidor. Usado para o que a pessoa
 *   não pode fazer sozinha: somar o uso diário, limites personalizados,
 *   apagar a conta, abrir o link de leitura e o painel interno.
 *
 * O cliente do corpus (supabase/server.ts) continua sem sessão nenhuma.
 */

export async function clienteConta(): Promise<SupabaseClient | null> {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) return null;
  const loja = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (novos) => {
        try {
          for (const { name, value, options } of novos) loja.set(name, value, options);
        } catch {
          // Server Component não grava cookie; o proxy renova a sessão.
        }
      },
    },
  });
}

let admin: SupabaseClient | null | undefined;

export function clienteAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;
  admin = url && chave ? createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return admin;
}

/** A pessoa logada nesta requisição, ou null. Validada no servidor do Supabase. */
export const usuarioAtual = cache(async (): Promise<User | null> => {
  const loja = await cookies();
  if (!loja.getAll().some((c) => c.name.startsWith("sb-"))) return null;
  const db = await clienteConta();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data.user ?? null;
});

/** Contas só funcionam com as duas chaves configuradas. */
export const contasLigadas = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY);
