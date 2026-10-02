"use client";

import { useSyncExternalStore } from "react";

/*
 * Carrinho da sessão — porte de st.session_state["carrinho"] (app.py).
 * Guarda só REFERÊNCIAS às análises do corpus (módulo + id + rótulo), no
 * sessionStorage: some quando a aba fecha, como a sessão do Streamlit, e não
 * sai do navegador. Os dados da planilha vêm do banco na hora de exportar.
 */

export type ModuloSessao = "lupa" | "disputa" | "dossie" | "voz";
export type ItemSessao = { modulo: ModuloSessao; id: number; rotulo: string };

const CHAVE = "raiox_sessao";
const EVENTO = "raiox-sessao";
const VAZIO: ItemSessao[] = [];
let cache: { bruto: string | null; itens: ItemSessao[] } = { bruto: null, itens: VAZIO };

function ler(): ItemSessao[] {
  let bruto: string | null = null;
  try {
    bruto = sessionStorage.getItem(CHAVE);
  } catch {
    return VAZIO;
  }
  if (bruto === cache.bruto) return cache.itens;
  let itens: ItemSessao[] = VAZIO;
  try {
    const v = JSON.parse(bruto ?? "[]");
    if (Array.isArray(v)) itens = v.filter((i) => i && typeof i.id === "number" && typeof i.modulo === "string");
  } catch {
    // conteúdo inválido: começa vazio
  }
  cache = { bruto, itens };
  return itens;
}

function gravar(itens: ItemSessao[]) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(itens));
  } catch {
    // sem armazenamento (modo privado restrito): o carrinho só não persiste
  }
  window.dispatchEvent(new Event(EVENTO));
}

export const naSessao = (itens: ItemSessao[], modulo: ModuloSessao, id: number) => itens.some((i) => i.modulo === modulo && i.id === id);

export function adicionarNaSessao(item: ItemSessao) {
  const itens = ler();
  if (!naSessao(itens, item.modulo, item.id)) gravar([...itens, item]);
}

export function removerDaSessao(modulo: ModuloSessao, id: number) {
  gravar(ler().filter((i) => !(i.modulo === modulo && i.id === id)));
}

export function limparSessao() {
  gravar([]);
}

function assinar(aviso: () => void) {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

/** Itens do carrinho, reativos (vazio na renderização do servidor). */
export function useSessao(): ItemSessao[] {
  return useSyncExternalStore(assinar, ler, () => VAZIO);
}
