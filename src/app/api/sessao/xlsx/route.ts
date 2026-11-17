import { cabecalhosXlsx, MAX_ITENS_XLSX, montarXlsx, type RefXlsx } from "@/lib/sessao/xlsx";

/*
 * Exportação do carrinho de sessão (sem conta). Recebe só referências
 * (módulo + id) e monta a planilha a partir do corpus público — ver
 * src/lib/sessao/xlsx.ts. Projetos têm rota própria, com as notas.
 */

export const maxDuration = 60;

export async function POST(req: Request) {
  let refs: RefXlsx[];
  try {
    const corpo = (await req.json()) as { itens?: RefXlsx[] };
    refs = (corpo.itens ?? [])
      .filter((r) => Number.isInteger(r?.id) && r.id > 0)
      .map((r) => ({ modulo: r.modulo, id: r.id }))
      .slice(0, MAX_ITENS_XLSX);
  } catch {
    return new Response("Pedido inválido.", { status: 400 });
  }
  if (!refs.length) return new Response("Sessão vazia.", { status: 400 });

  let buffer: ArrayBuffer;
  try {
    buffer = await montarXlsx(refs, new URL(req.url).origin);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Erro ao consultar o corpus.", { status: 502 });
  }
  const agora = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  return new Response(buffer, { headers: cabecalhosXlsx(`raio-x-sessao-${agora}.xlsx`) });
}
