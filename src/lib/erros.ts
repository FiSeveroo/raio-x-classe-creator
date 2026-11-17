import "server-only";
import { after } from "next/server";
import { supabaseGravacao, supabaseLeitura } from "@/lib/supabase/server";

/*
 * Registro de falhas do sistema na tabela erros_app (docs/sql/erros_app.sql),
 * lido na aba "Erros" do painel interno do Termômetro. Só falhas do sistema;
 * erros de quem usa (link inválido, limites) não entram. Sem dado pessoal.
 *
 * Nunca derruba a requisição: grava depois da resposta (after) e engole
 * qualquer erro do próprio registro (ex.: tabela ainda não criada).
 */

/** Códigos de ErroPrevisto que indicam falha do sistema, não de quem usa. */
const CODIGOS_DO_SISTEMA = new Set(["falha", "resposta_malformada", "youtube", "codigo_invalido", "recusa_ia", "resposta_truncada"]);

export type RegistroErro = { modulo: string; codigo: string; mensagem: string; entrada?: string | null };

const corte = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export async function gravarErro(r: RegistroErro): Promise<void> {
  try {
    const db = supabaseGravacao();
    if (!db) return;
    const { error } = await db.from("erros_app").insert({
      modulo: corte(r.modulo, 40),
      codigo: corte(r.codigo, 60),
      mensagem: corte(r.mensagem, 2000),
      entrada: r.entrada ? corte(r.entrada, 500) : null,
    });
    if (error) console.warn("[erros] não gravou:", error.message);
  } catch (e) {
    console.warn("[erros] não gravou:", e instanceof Error ? e.message : e);
  }
}

/** Agenda a gravação para depois da resposta. */
export function registrarErro(r: RegistroErro): void {
  try {
    after(() => gravarErro(r));
  } catch {
    // fora de uma requisição (ex.: script): grava direto, sem esperar
    void gravarErro(r);
  }
}

/** Para os catch dos módulos: registra só se o código for falha do sistema. */
export function registrarSeDoSistema(modulo: string, codigo: string, mensagem: string, entrada?: string): void {
  if (CODIGOS_DO_SISTEMA.has(codigo)) registrarErro({ modulo, codigo, mensagem, entrada });
}

export type ErroRegistrado = { id: number; criado_em: string; modulo: string; codigo: string; mensagem: string; entrada: string | null };

/** Últimos erros (padrão: 30 dias, até 500 linhas). null = tabela indisponível. */
export async function buscarErrosRecentes(dias = 30): Promise<ErroRegistrado[] | null> {
  const db = supabaseLeitura();
  if (!db) return null;
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await db
    .from("erros_app")
    .select("id, criado_em, modulo, codigo, mensagem, entrada")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false })
    .limit(500);
  if (error) return null;
  return data as ErroRegistrado[];
}

export type ResumoErro = { modulo: string; codigo: string; semana: number; total: number; ultimo: string };

/** Agrupa por módulo e código: quantos nos últimos 7 dias, no período todo e o mais recente. */
export function resumirErros(erros: ErroRegistrado[]): ResumoErro[] {
  const semana = Date.now() - 7 * 86_400_000;
  const grupos = new Map<string, ResumoErro>();
  for (const e of erros) {
    const chave = `${e.modulo}|${e.codigo}`;
    const g = grupos.get(chave) ?? { modulo: e.modulo, codigo: e.codigo, semana: 0, total: 0, ultimo: e.criado_em };
    g.total++;
    if (new Date(e.criado_em).getTime() >= semana) g.semana++;
    grupos.set(chave, g);
  }
  return [...grupos.values()].sort((a, b) => b.semana - a.semana || b.total - a.total);
}
