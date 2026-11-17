"use server";

import { clienteAdmin, clienteConta, usuarioAtual } from "@/lib/supabase/conta";

export type ResConta = { ok: true } | { ok: false; codigo: string };

export async function sair(): Promise<void> {
  const db = await clienteConta();
  await db?.auth.signOut();
}

export async function mudarSenha(senha: string): Promise<ResConta> {
  if (senha.length < 10) return { ok: false, codigo: "senha_curta" };
  const db = await clienteConta();
  if (!db || !(await usuarioAtual())) return { ok: false, codigo: "sem_login" };
  const { error } = await db.auth.updateUser({ password: senha });
  if (error) {
    console.warn("[conta] senha não alterada:", error.code ?? error.message);
    return { ok: false, codigo: error.code === "same_password" ? "mesma_senha" : error.code === "weak_password" ? "senha_fraca" : "falha" };
  }
  return { ok: true };
}

/**
 * Apaga a conta de quem está logado: e-mail, projetos, notas, uso e limites
 * (as tabelas apagam em cascata). As análises ficam no corpus público, sem
 * vínculo com ninguém — o corpus nunca registrou quem as rodou.
 */
export async function apagarMinhaConta(confirmacao: string): Promise<ResConta> {
  if (!["APAGAR", "DELETE", "BORRAR"].includes(confirmacao.trim().toUpperCase())) return { ok: false, codigo: "confirmacao" };
  const usuario = await usuarioAtual();
  const admin = clienteAdmin();
  if (!usuario || !admin) return { ok: false, codigo: "sem_login" };
  const { error } = await admin.auth.admin.deleteUser(usuario.id);
  if (error) {
    console.warn("[conta] não apagou:", error.message);
    return { ok: false, codigo: "falha" };
  }
  await (await clienteConta())?.auth.signOut();
  return { ok: true };
}
