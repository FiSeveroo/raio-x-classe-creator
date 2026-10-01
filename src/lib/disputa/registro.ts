import "server-only";
import { supabaseGravacao } from "@/lib/supabase/server";
import { db, descanonizarAnterior } from "@/lib/versionamento";
import { pyCorte } from "@/lib/py";

/*
 * Banco da Disputa — porte de db.py (buscar_canonica_busca, registrar_busca,
 * gravar_resultado_busca).
 */

export const TIPO_RESULTADO = "video,channel,playlist";

export type CanonicaBusca = { id: number; versao_numero: number | null; data_busca: string | null };

/** db.buscar_canonica_busca */
export async function buscarCanonicaBusca(termo: string): Promise<CanonicaBusca | null> {
  const { data, error } = await db()
    .from("buscas_narrativa")
    .select("id, versao_numero, data_busca")
    .eq("termo_buscado", pyCorte(termo, 500))
    .eq("tipo_resultado", TIPO_RESULTADO)
    .eq("canonica", true)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as CanonicaBusca) ?? null;
}

export type ItemClassificado = {
  posicao: number;
  tipo_item: string;
  item_id: string;
  titulo: string;
  canal_id: string;
  canal_nome: string;
  tipo_produtor: string;
  tipo_conteudo: string;
  justificativa: string;
};

/**
 * db.registrar_busca + db.gravar_resultado_busca. O Python inseria os
 * resultados um a um; aqui vão num único insert (mesmas linhas).
 */
export async function registrarBusca(r: {
  termo: string;
  total: number;
  composicao_produtor_json: string;
  composicao_conteudo_json: string;
  versao_numero: number;
  versao_anterior_id: number | null;
  itens: ItemClassificado[];
}): Promise<number> {
  if (r.versao_numero > 1 && r.versao_anterior_id) {
    await descanonizarAnterior("buscas_narrativa", r.versao_anterior_id);
  }
  const cliente = supabaseGravacao()!;
  const { data, error } = await cliente
    .from("buscas_narrativa")
    .insert({
      termo_buscado: pyCorte(r.termo, 500),
      tipo_resultado: TIPO_RESULTADO,
      total_analisados: r.total,
      composicao_produtor: r.composicao_produtor_json,
      composicao_conteudo: r.composicao_conteudo_json,
      versao_numero: r.versao_numero,
      versao_anterior_id: r.versao_anterior_id,
      canonica: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const buscaId = data.id as number;

  const { error: e2 } = await cliente.from("resultados_busca").insert(
    r.itens.map((c) => ({
      busca_id: buscaId,
      posicao_ranking: c.posicao,
      tipo_item: c.tipo_item,
      item_id: c.item_id,
      titulo: pyCorte(c.titulo, 500),
      canal_id: c.canal_id,
      canal_nome: c.canal_nome ? pyCorte(c.canal_nome, 200) : "",
      tipo_produtor: c.tipo_produtor,
      tipo_conteudo: c.tipo_conteudo,
      justificativa: c.justificativa,
      metadados_extras: "{}", // json.dumps({}) — o Python nunca passava metadados aqui
    })),
  );
  if (e2) throw new Error(e2.message);
  return buscaId;
}
