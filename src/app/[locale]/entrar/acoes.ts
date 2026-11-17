"use server";

import { getLocale } from "next-intl/server";
import { clienteConta } from "@/lib/supabase/conta";
import { humanoVerificado } from "@/lib/turnstile";

/*
 * Entrar e criar conta (decisão do Filipe em 17/nov/2026): link mágico por
 * e-mail ou e-mail + senha (mínimo 10 caracteres). Os e-mails saem pela
 * Resend (SMTP do Supabase) com links para /api/auth/confirmar. O idioma do
 * site vai em user_metadata.idioma para os modelos de e-mail.
 *
 * As ações que disparam e-mail passam pelo Turnstile antes, para ninguém usar
 * o formulário para mandar e-mail em massa.
 */

export type ResultadoEntrar = { ok: true; aviso?: "link_enviado" | "confirme_email" | "senha_enviada" } | { ok: false; codigo: string };

const SENHA_MINIMA = 10;

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;

function erro(codigo: string): ResultadoEntrar {
  return { ok: false, codigo };
}

/** Traduz os erros do Supabase Auth para códigos de mensagem do site. */
function codigoDoErro(e: { message?: string; code?: string; status?: number }): string {
  const c = e.code ?? "";
  if (c === "invalid_credentials") return "credenciais";
  if (c === "email_not_confirmed") return "nao_confirmado";
  if (c === "user_already_exists" || c === "email_exists") return "ja_existe";
  if (c === "weak_password") return "senha_fraca";
  if (c === "over_email_send_rate_limit" || c === "over_request_rate_limit" || e.status === 429) return "muitas_tentativas";
  console.warn("[entrar] erro do Supabase Auth:", c, e.message);
  return "falha";
}

export async function enviarLink(email: string): Promise<ResultadoEntrar> {
  email = email.trim().toLowerCase();
  if (!emailValido(email)) return erro("email_invalido");
  if (!(await humanoVerificado())) return erro("verificacao");
  const db = await clienteConta();
  if (!db) return erro("desligado");
  const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { idioma: await getLocale() } } });
  return error ? erro(codigoDoErro(error)) : { ok: true, aviso: "link_enviado" };
}

export async function entrarComSenha(email: string, senha: string): Promise<ResultadoEntrar> {
  email = email.trim().toLowerCase();
  if (!emailValido(email) || !senha) return erro("credenciais");
  const db = await clienteConta();
  if (!db) return erro("desligado");
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  return error ? erro(codigoDoErro(error)) : { ok: true };
}

export async function criarConta(email: string, senha: string): Promise<ResultadoEntrar> {
  email = email.trim().toLowerCase();
  if (!emailValido(email)) return erro("email_invalido");
  if (senha.length < SENHA_MINIMA) return erro("senha_curta");
  if (!(await humanoVerificado())) return erro("verificacao");
  const db = await clienteConta();
  if (!db) return erro("desligado");
  const { data, error } = await db.auth.signUp({ email, password: senha, options: { data: { idioma: await getLocale() } } });
  if (error) return erro(codigoDoErro(error));
  // Com confirmação de e-mail ligada, não vem sessão: falta clicar no link.
  return data.session ? { ok: true } : { ok: true, aviso: "confirme_email" };
}

export async function esqueciSenha(email: string): Promise<ResultadoEntrar> {
  email = email.trim().toLowerCase();
  if (!emailValido(email)) return erro("email_invalido");
  if (!(await humanoVerificado())) return erro("verificacao");
  const db = await clienteConta();
  if (!db) return erro("desligado");
  const { error } = await db.auth.resetPasswordForEmail(email);
  // Mesmo aviso exista ou não a conta (não revela quem tem conta).
  if (error && codigoDoErro(error) === "muitas_tentativas") return erro("muitas_tentativas");
  return { ok: true, aviso: "senha_enviada" };
}
