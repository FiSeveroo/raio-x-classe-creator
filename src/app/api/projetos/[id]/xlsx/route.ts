import { buscarProjeto } from "@/lib/projetos";
import { cabecalhosXlsx, MAX_ITENS_XLSX, montarXlsx } from "@/lib/sessao/xlsx";
import { usuarioAtual } from "@/lib/supabase/conta";

/*
 * XLSX de um projeto, com a coluna "nota". Só o dono baixa (decisão do
 * Filipe em 17/nov/2026): buscarProjeto age como a pessoa logada, e o RLS
 * de projetos/projeto_itens não devolve projeto de outra conta. O link de
 * leitura (/p/[token]) não exporta.
 */

export const maxDuration = 60;

export async function GET(req: Request, ctx: RouteContext<"/api/projetos/[id]/xlsx">) {
  const { id } = await ctx.params;
  const projetoId = Number(id);
  if (!Number.isInteger(projetoId) || projetoId <= 0) return new Response("Projeto inválido.", { status: 400 });
  if (!(await usuarioAtual())) return new Response("Entre na tua conta.", { status: 401 });

  let dados;
  try {
    dados = await buscarProjeto(projetoId);
  } catch {
    return new Response("Contas indisponíveis.", { status: 503 });
  }
  if (!dados) return new Response("Projeto não encontrado.", { status: 404 });
  if (!dados.itens.length) return new Response("Projeto vazio.", { status: 400 });

  // Ordem da tela (mais recente primeiro); id = versão exata guardada no item.
  const refs = dados.itens.slice(0, MAX_ITENS_XLSX).map((i) => ({ modulo: i.modulo, id: i.analise_id, nota: i.nota ?? "" }));

  let buffer: ArrayBuffer;
  try {
    buffer = await montarXlsx(refs, new URL(req.url).origin, true);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Erro ao consultar o corpus.", { status: 502 });
  }
  return new Response(buffer, { headers: cabecalhosXlsx(`raio-x-projeto-${projetoId}.xlsx`) });
}
