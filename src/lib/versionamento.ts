import "server-only";
import { cookies } from "next/headers";
import { supabaseGravacao, supabaseLeitura } from "@/lib/supabase/server";

/*
 * Regras de corpus compartilhadas pelos módulos — porte de db.py
 * (calcular_peso_atualizacao, pode_atualizar, descanonizar_anterior,
 * contar_uso_diario) e dos limites de app.py.
 */

export const COOLDOWN_ATUALIZACAO_DIAS = 30;

export type Modulo = "lupa" | "dossie" | "disputa" | "voz";

// app.py: LIMITE_*_POR_SESSAO e LIMITES_DIARIOS
export const LIMITES: Record<Modulo, { sessao: number; diario: number }> = {
  lupa: { sessao: 15, diario: 80 },
  disputa: { sessao: 3, diario: 30 },
  dossie: { sessao: 5, diario: 40 },
  voz: { sessao: 5, diario: 25 },
};

// db.contar_uso_diario: tabela e coluna de data de cada módulo
const TABELA_DATA: Record<Modulo, [string, string]> = {
  lupa: ["classificacoes_video", "data_classificacao"],
  disputa: ["buscas_narrativa", "data_busca"],
  dossie: ["dossies_canal", "data_dossie"],
  voz: ["analises_comentarios", "data_analise"],
};

export function db() {
  const c = supabaseLeitura();
  if (!c) throw new Error("Supabase não configurado.");
  return c;
}

/** db.calcular_peso_atualizacao — v1: 1 slot; vN: 2^(N-1) slots. */
export function calcularPesoAtualizacao(versaoNumero: number): number {
  return versaoNumero <= 1 ? 1 : 2 ** (versaoNumero - 1);
}

/**
 * db.pode_atualizar — cooldown de 30 dias desde a versão canônica.
 * Data ilegível libera a atualização (como no Python).
 */
export function podeAtualizar(
  dataCanonicaIso: string | null | undefined,
  cooldownDias = COOLDOWN_ATUALIZACAO_DIAS,
): { pode: boolean; diasRestantes: number } {
  if (!dataCanonicaIso) return { pode: true, diasRestantes: 0 };
  // Sem fuso explícito, o Python trata como UTC (compara com utcnow()).
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(dataCanonicaIso);
  const data = new Date(temFuso ? dataCanonicaIso : `${dataCanonicaIso}Z`);
  if (Number.isNaN(data.getTime())) return { pode: true, diasRestantes: 0 };
  const deltaMs = Date.now() - data.getTime();
  if (deltaMs >= cooldownDias * 86_400_000) return { pode: true, diasRestantes: 0 };
  const deltaDias = Math.floor(deltaMs / 86_400_000); // timedelta.days
  return { pode: false, diasRestantes: Math.max(1, cooldownDias - deltaDias) };
}

/** db.descanonizar_anterior */
export async function descanonizarAnterior(tabela: string, registroId: number) {
  const { error } = await supabaseGravacao()!.from(tabela).update({ canonica: false }).eq("id", registroId);
  if (error) throw new Error(error.message);
}

/**
 * db.contar_uso_diario — análises de hoje (data UTC; o Streamlit Cloud roda
 * em UTC). Em caso de erro, devolve 0 (não bloqueia), como no Python.
 */
export async function contarUsoDiario(modulo: Modulo): Promise<number> {
  const [tabela, coluna] = TABELA_DATA[modulo];
  const hoje = new Date().toISOString().slice(0, 10);
  const { count, error } = await db()
    .from(tabela)
    .select("id", { count: "exact", head: true })
    .gte(coluna, `${hoje}T00:00:00`)
    .lte(coluna, `${hoje}T23:59:59`);
  return error ? 0 : (count ?? 0);
}

// ---------------------------------------------------------------------------
// Slots da sessão — cookie de sessão por módulo (sem dado pessoal). No
// Streamlit ficava em st.session_state e zerava ao recarregar a página.
// ---------------------------------------------------------------------------

const nomeCookie = (m: Modulo) => `raiox_${m}_usadas`;

export async function slotsUsados(modulo: Modulo): Promise<number> {
  const n = Number((await cookies()).get(nomeCookie(modulo))?.value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Só pode ser chamado em Server Action / Route Handler (escreve cookie). */
export async function consumirSlots(modulo: Modulo, peso: number) {
  const usados = await slotsUsados(modulo);
  (await cookies()).set(nomeCookie(modulo), String(usados + peso), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // sem maxAge: cookie de sessão, some quando o navegador fecha
  });
}

/** Resposta padrão quando já existe versão canônica do objeto. */
export type Existente = {
  estado: "existente";
  id: number;
  versao: number;
  data: string | null;
  pode: boolean;
  diasRestantes: number;
  proximaVersao: number;
  peso: number;
};

export function descreverExistente(c: { id: number; versao_numero: number | null }, data: string | null): Existente {
  const versao = c.versao_numero ?? 1;
  const { pode, diasRestantes } = podeAtualizar(data);
  return {
    estado: "existente",
    id: c.id,
    versao,
    data,
    pode,
    diasRestantes,
    proximaVersao: versao + 1,
    peso: calcularPesoAtualizacao(versao + 1),
  };
}

/** Resposta comum das ações de análise dos módulos. */
export type ResultadoModulo =
  | { estado: "ok"; id: number }
  | Existente
  | { estado: "erro"; codigo: string; detalhe?: string; peso?: number; restantes?: number; uso?: number };
