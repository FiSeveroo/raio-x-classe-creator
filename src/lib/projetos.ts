import "server-only";
import { randomBytes } from "node:crypto";
import type { ModuloProjeto } from "@/lib/corpus";
import { clienteAdmin, clienteConta, usuarioAtual } from "@/lib/supabase/conta";

/*
 * Projetos de pesquisa (decisões do Filipe em 17/nov/2026). Tudo aqui age como
 * a pessoa logada (RLS: só os próprios projetos), exceto o link de leitura,
 * que é aberto pelo servidor com a chave secreta a partir do token.
 *
 * Um item aponta para a VERSÃO EXATA da análise (id da linha no corpus); a
 * troca para a versão mais nova é sempre um gesto do pesquisador.
 */

export const MODULOS_PROJETO: ModuloProjeto[] = ["lupa", "dossie", "disputa", "voz"];

export type Projeto = {
  id: number;
  nome: string;
  descricao: string;
  token_leitura: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type ItemProjeto = {
  id: number;
  projeto_id: number;
  modulo: ModuloProjeto;
  analise_id: number;
  nota: string;
  adicionado_em: string;
};

export type ProjetoComTotal = Projeto & { total: number };

async function db() {
  const c = await clienteConta();
  if (!c) throw new Error("Contas desligadas.");
  return c;
}

function falhou(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function tocarProjeto(id: number) {
  await (await db()).from("projetos").update({ atualizado_em: new Date().toISOString() }).eq("id", id);
}

export async function listarProjetos(): Promise<ProjetoComTotal[]> {
  const { data, error } = await (await db())
    .from("projetos")
    .select("id, nome, descricao, token_leitura, criado_em, atualizado_em, projeto_itens(count)")
    .order("atualizado_em", { ascending: false });
  falhou(error);
  return ((data ?? []) as (Projeto & { projeto_itens: { count: number }[] })[]).map(({ projeto_itens, ...p }) => ({
    ...p,
    total: projeto_itens?.[0]?.count ?? 0,
  }));
}

export async function buscarProjeto(id: number): Promise<{ projeto: Projeto; itens: ItemProjeto[] } | null> {
  const c = await db();
  const [p, i] = await Promise.all([
    c.from("projetos").select("id, nome, descricao, token_leitura, criado_em, atualizado_em").eq("id", id).maybeSingle(),
    c.from("projeto_itens").select("id, projeto_id, modulo, analise_id, nota, adicionado_em").eq("projeto_id", id).order("adicionado_em", { ascending: false }),
  ]);
  if (p.error || !p.data) return null;
  return { projeto: p.data as Projeto, itens: (i.data ?? []) as ItemProjeto[] };
}

/** Projeto aberto pelo link de leitura (sem login). Nunca devolve o dono. */
export async function projetoPorToken(token: string): Promise<{ projeto: Projeto; itens: ItemProjeto[] } | null> {
  const c = clienteAdmin();
  if (!c || !/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const { data: p } = await c.from("projetos").select("id, nome, descricao, token_leitura, criado_em, atualizado_em").eq("token_leitura", token).maybeSingle();
  if (!p) return null;
  const { data: i } = await c.from("projeto_itens").select("id, projeto_id, modulo, analise_id, nota, adicionado_em").eq("projeto_id", p.id).order("adicionado_em", { ascending: false });
  return { projeto: p as Projeto, itens: (i ?? []) as ItemProjeto[] };
}

export async function criarProjeto(nome: string, descricao = ""): Promise<number> {
  const usuario = await usuarioAtual();
  if (!usuario) throw new Error("Sem login.");
  const { data, error } = await (await db())
    .from("projetos")
    .insert({ dono: usuario.id, nome: nome.trim().slice(0, 120), descricao: descricao.trim().slice(0, 4000) })
    .select("id")
    .single();
  falhou(error);
  return (data as { id: number }).id;
}

export async function editarProjeto(id: number, campos: { nome?: string; descricao?: string }) {
  const novo: Record<string, string> = { atualizado_em: new Date().toISOString() };
  if (campos.nome !== undefined) novo.nome = campos.nome.trim().slice(0, 120);
  if (campos.descricao !== undefined) novo.descricao = campos.descricao.trim().slice(0, 4000);
  const { error } = await (await db()).from("projetos").update(novo).eq("id", id);
  falhou(error);
}

export async function apagarProjeto(id: number) {
  const { error } = await (await db()).from("projetos").delete().eq("id", id);
  falhou(error);
}

// --- Projeto ativo -----------------------------------------------------------

export async function projetoAtivoId(): Promise<number | null> {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  const { data } = await (await db()).from("perfis").select("projeto_ativo_id").eq("id", usuario.id).maybeSingle();
  return (data as { projeto_ativo_id: number | null } | null)?.projeto_ativo_id ?? null;
}

export async function definirProjetoAtivo(id: number | null) {
  const usuario = await usuarioAtual();
  if (!usuario) throw new Error("Sem login.");
  const { error } = await (await db()).from("perfis").upsert({ id: usuario.id, projeto_ativo_id: id });
  falhou(error);
}

/**
 * Depois de uma análise gravada: entra no projeto ativo, se houver. Nunca
 * derruba a análise (que já está no corpus).
 */
export async function adicionarAoProjetoAtivo(modulo: ModuloProjeto, analiseId: number) {
  try {
    const ativo = await projetoAtivoId();
    if (ativo) await adicionarItem(ativo, modulo, analiseId);
  } catch (e) {
    console.warn("[projetos] não entrou no projeto ativo:", e instanceof Error ? e.message : e);
  }
}

// --- Itens -------------------------------------------------------------------

export async function adicionarItem(projetoId: number, modulo: ModuloProjeto, analiseId: number, nota = "") {
  if (!MODULOS_PROJETO.includes(modulo) || !Number.isInteger(analiseId) || analiseId <= 0) throw new Error("Item inválido.");
  const { error } = await (await db())
    .from("projeto_itens")
    .upsert({ projeto_id: projetoId, modulo, analise_id: analiseId, nota }, { onConflict: "projeto_id,modulo,analise_id", ignoreDuplicates: true });
  falhou(error);
  await tocarProjeto(projetoId);
}

async function item(id: number): Promise<ItemProjeto> {
  const { data, error } = await (await db()).from("projeto_itens").select("*").eq("id", id).single();
  falhou(error);
  return data as ItemProjeto;
}

export async function removerItem(id: number) {
  const { error } = await (await db()).from("projeto_itens").delete().eq("id", id);
  falhou(error);
}

export async function editarNota(id: number, nota: string) {
  const { error } = await (await db()).from("projeto_itens").update({ nota: nota.slice(0, 4000) }).eq("id", id);
  falhou(error);
}

/** Copia para outro projeto, com a nota. Se já estiver lá, não duplica. */
export async function copiarItem(id: number, destinoId: number) {
  const i = await item(id);
  await adicionarItem(destinoId, i.modulo, i.analise_id, i.nota);
}

export async function moverItem(id: number, destinoId: number) {
  const i = await item(id);
  if (i.projeto_id === destinoId) return;
  await adicionarItem(destinoId, i.modulo, i.analise_id, i.nota);
  await removerItem(id);
}

/** Troca para a versão mais nova da análise (gesto explícito do pesquisador). */
export async function trocarVersao(id: number, novaAnaliseId: number) {
  const i = await item(id);
  const c = await db();
  const { data: ja } = await c.from("projeto_itens").select("id").eq("projeto_id", i.projeto_id).eq("modulo", i.modulo).eq("analise_id", novaAnaliseId).maybeSingle();
  if (ja) {
    await removerItem(id);
    return;
  }
  const { error } = await c.from("projeto_itens").update({ analise_id: novaAnaliseId }).eq("id", id);
  falhou(error);
}

// --- Link de leitura ---------------------------------------------------------

export async function gerarLinkLeitura(projetoId: number): Promise<string> {
  const token = randomBytes(18).toString("base64url");
  const { error } = await (await db()).from("projetos").update({ token_leitura: token }).eq("id", projetoId);
  falhou(error);
  return token;
}

export async function revogarLinkLeitura(projetoId: number) {
  const { error } = await (await db()).from("projetos").update({ token_leitura: null }).eq("id", projetoId);
  falhou(error);
}
