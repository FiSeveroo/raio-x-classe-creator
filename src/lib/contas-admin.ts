import "server-only";
import { clienteAdmin } from "@/lib/supabase/conta";
import { supabaseLeitura } from "@/lib/supabase/server";
import { FATOR_CONTA, LIMITES, type Modulo } from "@/lib/versionamento";

/*
 * Painel interno (senha do Termômetro): contas e uso do site. Usa a chave
 * secreta; só é chamado depois de painelLiberado().
 */

const MODULOS: Modulo[] = ["lupa", "dossie", "disputa", "voz"];

export type ContaPainel = {
  id: string;
  email: string;
  criadaEm: string;
  ultimoAcesso: string | null;
  projetos: number;
  usoHoje: Partial<Record<Modulo, number>>;
  limites: Partial<Record<Modulo, number | null>>;
};

export const LIMITE_PADRAO_CONTA = Object.fromEntries(MODULOS.map((m) => [m, LIMITES[m].sessao * FATOR_CONTA])) as Record<Modulo, number>;

export async function listarContas(busca = ""): Promise<ContaPainel[] | null> {
  const db = clienteAdmin();
  if (!db) return null;
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  const q = busca.trim().toLowerCase();
  const usuarios = data.users.filter((u) => !q || (u.email ?? "").toLowerCase().includes(q)).slice(0, 100);
  if (!usuarios.length) return [];
  const ids = usuarios.map((u) => u.id);
  const hoje = new Date().toISOString().slice(0, 10);
  const [lim, uso, proj] = await Promise.all([
    db.from("limites_conta").select("*").in("user_id", ids),
    db.from("uso_conta").select("user_id, modulo, slots").in("user_id", ids).eq("dia", hoje),
    db.from("projetos").select("dono").in("dono", ids),
  ]);
  return usuarios
    .map((u) => {
      const l = ((lim.data ?? []) as Record<string, unknown>[]).find((x) => x.user_id === u.id);
      const usoHoje: Partial<Record<Modulo, number>> = {};
      for (const x of (uso.data ?? []) as { user_id: string; modulo: Modulo; slots: number }[]) if (x.user_id === u.id) usoHoje[x.modulo] = x.slots;
      return {
        id: u.id,
        email: u.email ?? "",
        criadaEm: u.created_at,
        ultimoAcesso: u.last_sign_in_at ?? null,
        projetos: ((proj.data ?? []) as { dono: string }[]).filter((p) => p.dono === u.id).length,
        usoHoje,
        limites: Object.fromEntries(MODULOS.map((m) => [m, (l?.[m] as number | null | undefined) ?? null])),
      };
    })
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

/** Limite personalizado; null num módulo volta ao padrão de conta (o dobro). */
export async function definirLimites(userId: string, limites: Record<Modulo, number | null>) {
  const db = clienteAdmin();
  if (!db) throw new Error("Chave secreta ausente.");
  const { error } = await db.from("limites_conta").upsert({ user_id: userId, ...limites, alterado_em: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// --- Uso do site --------------------------------------------------------------

const TABELA_DATA: Record<Modulo, [string, string]> = {
  lupa: ["classificacoes_video", "data_classificacao"],
  disputa: ["buscas_narrativa", "data_busca"],
  dossie: ["dossies_canal", "data_dossie"],
  voz: ["analises_comentarios", "data_analise"],
};

export type UsoSite = {
  dias: string[];
  analises: Record<Modulo, number[]>;
  totaisModulo: Record<Modulo, number>;
  contas: number | null;
  contasNovas30: number | null;
  projetos: number | null;
};

/** Análises por dia (últimos 30 dias, UTC), contas e projetos. */
export async function usoDoSite(): Promise<UsoSite | null> {
  const corpus = supabaseLeitura();
  if (!corpus) return null;
  const dias = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10));
  const desde = `${dias[0]}T00:00:00`;
  const analises = {} as Record<Modulo, number[]>;
  const totaisModulo = {} as Record<Modulo, number>;
  await Promise.all(
    MODULOS.map(async (m) => {
      const [tabela, coluna] = TABELA_DATA[m];
      const { data } = await corpus.from(tabela).select(coluna).gte(coluna, desde).limit(5000);
      const contagem = new Map<string, number>();
      for (const r of (data ?? []) as unknown as Record<string, string>[]) {
        const d = String(r[coluna]).slice(0, 10);
        contagem.set(d, (contagem.get(d) ?? 0) + 1);
      }
      analises[m] = dias.map((d) => contagem.get(d) ?? 0);
      totaisModulo[m] = analises[m].reduce((s, n) => s + n, 0);
    }),
  );

  const admin = clienteAdmin();
  let contas: number | null = null;
  let contasNovas30: number | null = null;
  let projetos: number | null = null;
  if (admin) {
    const [u, p] = await Promise.all([admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), admin.from("projetos").select("id", { count: "exact", head: true })]);
    if (!u.error) {
      contas = u.data.users.length;
      contasNovas30 = u.data.users.filter((x) => x.created_at >= desde).length;
    }
    projetos = p.count ?? null;
  }
  return { dias, analises, totaisModulo, contas, contasNovas30, projetos };
}
