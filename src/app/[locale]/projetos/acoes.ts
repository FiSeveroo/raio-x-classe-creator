"use server";

import type { ModuloProjeto } from "@/lib/corpus";
import {
  adicionarItem,
  apagarProjeto,
  copiarItem,
  criarProjeto,
  definirProjetoAtivo,
  editarNota,
  editarProjeto,
  gerarLinkLeitura,
  listarProjetos,
  moverItem,
  projetoAtivoId,
  removerItem,
  revogarLinkLeitura,
  trocarVersao,
} from "@/lib/projetos";
import { usuarioAtual } from "@/lib/supabase/conta";

/*
 * Ações dos projetos, chamadas pelos botões. Todas exigem login; a RLS do
 * banco garante que cada pessoa só mexe nos próprios projetos.
 */

type Res<T = void> = { ok: true; dados?: T } | { ok: false; codigo: string };

async function comLogin<T>(fn: () => Promise<T>): Promise<Res<T>> {
  if (!(await usuarioAtual())) return { ok: false, codigo: "sem_login" };
  try {
    return { ok: true, dados: await fn() };
  } catch (e) {
    console.warn("[projetos]", e instanceof Error ? e.message : e);
    return { ok: false, codigo: "falha" };
  }
}

const idOk = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

export async function acaoCriarProjeto(nome: string, descricao = "", ativar = true): Promise<Res<number>> {
  if (!nome.trim()) return { ok: false, codigo: "nome_vazio" };
  return comLogin(async () => {
    const id = await criarProjeto(nome, descricao);
    if (ativar) await definirProjetoAtivo(id);
    return id;
  });
}

export async function acaoEditarProjeto(id: number, nome: string, descricao: string): Promise<Res> {
  if (!idOk(id) || !nome.trim()) return { ok: false, codigo: "nome_vazio" };
  return comLogin(() => editarProjeto(id, { nome, descricao }));
}

export async function acaoApagarProjeto(id: number): Promise<Res> {
  if (!idOk(id)) return { ok: false, codigo: "falha" };
  return comLogin(() => apagarProjeto(id));
}

export async function acaoDefinirAtivo(id: number | null): Promise<Res> {
  if (id !== null && !idOk(id)) return { ok: false, codigo: "falha" };
  return comLogin(() => definirProjetoAtivo(id));
}

/** Para o botão "Adicionar ao projeto": lista curta + qual está ativo. */
export async function acaoMeusProjetos(): Promise<Res<{ projetos: { id: number; nome: string }[]; ativo: number | null }>> {
  return comLogin(async () => {
    const [lista, ativo] = await Promise.all([listarProjetos(), projetoAtivoId()]);
    return { projetos: lista.map((p) => ({ id: p.id, nome: p.nome })), ativo };
  });
}

/** Adiciona uma ou várias análises (carrinho) a um projeto existente ou novo. */
export async function acaoAdicionarAoProjeto(
  destino: number | { novo: string },
  itens: { modulo: ModuloProjeto; id: number }[],
): Promise<Res<number>> {
  const validos = itens.filter((i) => idOk(i.id)).slice(0, 200);
  if (!validos.length) return { ok: false, codigo: "falha" };
  if (typeof destino !== "number" && !destino.novo.trim()) return { ok: false, codigo: "nome_vazio" };
  return comLogin(async () => {
    const id = typeof destino === "number" ? destino : await criarProjeto(destino.novo);
    for (const i of validos) await adicionarItem(id, i.modulo, i.id);
    return id;
  });
}

export async function acaoRemoverItem(id: number): Promise<Res> {
  return idOk(id) ? comLogin(() => removerItem(id)) : { ok: false, codigo: "falha" };
}

export async function acaoNota(id: number, nota: string): Promise<Res> {
  return idOk(id) ? comLogin(() => editarNota(id, nota)) : { ok: false, codigo: "falha" };
}

export async function acaoMoverOuCopiar(id: number, destinoId: number, copiar: boolean): Promise<Res> {
  if (!idOk(id) || !idOk(destinoId)) return { ok: false, codigo: "falha" };
  return comLogin(() => (copiar ? copiarItem(id, destinoId) : moverItem(id, destinoId)));
}

export async function acaoTrocarVersao(id: number, novaId: number): Promise<Res> {
  if (!idOk(id) || !idOk(novaId)) return { ok: false, codigo: "falha" };
  return comLogin(() => trocarVersao(id, novaId));
}

export async function acaoLinkLeitura(projetoId: number, ligar: boolean): Promise<Res<string | null>> {
  if (!idOk(projetoId)) return { ok: false, codigo: "falha" };
  return comLogin(async () => (ligar ? await gerarLinkLeitura(projetoId) : (await revogarLinkLeitura(projetoId), null)));
}
