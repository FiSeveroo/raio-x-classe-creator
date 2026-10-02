import ExcelJS from "exceljs";
import { registrosPorIds, resultadosDeBusca } from "@/lib/corpus";

/*
 * Exportação da sessão em XLSX — porte do "Exportar sessão (.xlsx)" do
 * app.py: uma aba por módulo (Lupa, Disputa, Dossiê, Voz da Base), mesmos
 * nomes de coluna. Recebe só referências (módulo + id); os dados vêm do
 * corpus, não do navegador.
 *
 * Correções em relação ao Streamlit (que lia chaves inexistentes e gravava
 * vazio/0): inscritos e data de publicação na Lupa; item_id na Disputa (era
 * "video_id", sempre vazio); total de vídeos e sintomas reais no Dossiê; IPP
 * na Voz (era analise["ipp"], sempre vazio). "data_analise" é a data da
 * análise no corpus (o Streamlit punha a hora da exportação). Colunas novas:
 * versao, id_analise e link para a análise.
 */

export const maxDuration = 60;

type Ref = { modulo: string; id: number };
type Linha = Record<string, string | number | boolean | null>;

const MAX_ITENS = 200;

function json<T>(s: unknown, padrao: T): T {
  if (typeof s !== "string" || !s) return padrao;
  try {
    return JSON.parse(s) as T;
  } catch {
    return padrao;
  }
}

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export async function POST(req: Request) {
  let refs: Ref[];
  try {
    const corpo = (await req.json()) as { itens?: Ref[] };
    refs = (corpo.itens ?? []).filter((r) => Number.isInteger(r?.id) && r.id > 0).slice(0, MAX_ITENS);
  } catch {
    return new Response("Pedido inválido.", { status: 400 });
  }
  if (!refs.length) return new Response("Sessão vazia.", { status: 400 });

  const origem = new URL(req.url).origin;
  const ids = (m: string) => [...new Set(refs.filter((r) => r.modulo === m).map((r) => r.id))];
  const buscar = async (m: "lupa" | "disputa" | "dossie" | "voz") => {
    const lista = ids(m);
    if (!lista.length) return [];
    const r = await registrosPorIds(m, lista);
    if (r.status !== "ok") throw new Error(r.status === "erro" ? r.mensagem : "Banco não configurado.");
    // Mesma ordem em que entraram na sessão.
    return lista.map((id) => r.dados.find((d) => d.id === id)).filter(Boolean) as Record<string, unknown>[];
  };

  let lupa, disputa, dossie, voz;
  try {
    [lupa, disputa, dossie, voz] = await Promise.all([buscar("lupa"), buscar("disputa"), buscar("dossie"), buscar("voz")]);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Erro ao consultar o corpus.", { status: 502 });
  }

  const abas: [string, Linha[]][] = [];

  if (lupa.length) {
    abas.push([
      "Lupa",
      lupa.map((r) => {
        const m = json<Record<string, unknown>>(r.metadados_json, {});
        return {
          video_id: txt(r.video_id),
          titulo: txt(r.titulo),
          canal: txt(r.canal_nome),
          canal_id: txt(r.canal_id),
          tipo_produtor: txt(r.tipo_produtor),
          tipo_conteudo: txt(r.tipo_conteudo),
          justificativa: txt(r.justificativa),
          visualizacoes: num(m.visualizacoes),
          likes: num(m.likes),
          comentarios: num(m.comentarios),
          inscritos: num(m.inscritos),
          data_publicacao: txt(m.data_publicacao),
          data_analise: txt(r.data_classificacao),
          versao: num(r.versao_numero),
          id_analise: num(r.id),
          link: `${origem}/biblioteca/video/${r.id}`,
        };
      }),
    ]);
  }

  if (disputa.length) {
    const itens = await Promise.all(disputa.map((b) => resultadosDeBusca(Number(b.id))));
    const linhas: Linha[] = [];
    disputa.forEach((b, i) => {
      const r = itens[i];
      if (r.status !== "ok") return;
      for (const it of r.dados) {
        linhas.push({
          termo_busca: txt(b.termo_buscado),
          busca_id: num(b.id),
          posicao: it.posicao_ranking,
          tipo_item: it.tipo_item,
          item_id: it.item_id,
          titulo: txt(it.titulo),
          canal: txt(it.canal_nome),
          canal_id: txt(it.canal_id),
          tipo_produtor: it.tipo_produtor,
          tipo_conteudo: it.tipo_conteudo,
          justificativa: txt(it.justificativa),
          data_analise: txt(b.data_busca),
          versao: num(b.versao_numero),
          link: `${origem}/biblioteca/tema/${b.id}`,
        });
      }
    });
    abas.push(["Disputa", linhas]);
  }

  if (dossie.length) {
    abas.push([
      "Dossiê",
      dossie.map((d) => {
        const s = json<Record<string, unknown>>(d.sintomas_estruturais, {});
        return {
          canal: txt(d.canal_nome),
          canal_id: txt(d.canal_id),
          inscritos: num(d.inscritos),
          total_videos: num(d.total_videos_canal),
          videos_analisados: num(d.total_videos_analisados),
          auto_classificacao: txt(d.auto_classificacao),
          classificacao_sociologica: txt(d.classificacao_sociologica),
          tipo_conteudo_predominante: txt(d.tipo_conteudo_predominante),
          veredito: txt(d.veredito_sonnet),
          frequencia_videos_por_dia: num(s.frequencia_videos_por_dia),
          pct_shorts: num(s.pct_shorts),
          duracao_mediana_segundos: num(s.duracao_mediana_segundos),
          pct_titulos_padronizados: num(s.pct_titulos_padronizados),
          data_analise: txt(d.data_dossie),
          versao: num(d.versao_numero),
          id_analise: num(d.id),
          link: `${origem}/biblioteca/canal/${d.id}`,
        };
      }),
    ]);
  }

  if (voz.length) {
    abas.push([
      "Voz da Base",
      voz.map((a) => ({
        video_id: txt(a.video_id),
        titulo: txt(a.titulo_video),
        canal: txt(a.canal_nome),
        total_comentarios: num(a.total_analisados),
        ipp: num(a.indice_pressao_produtiva),
        distribuicao_dimensoes: txt(a.distribuicao_dimensoes),
        sintese: txt(a.sintese_qualitativa),
        contradicao_estrutural: txt(a.contradicao_estrutural),
        data_analise: txt(a.data_analise),
        versao: num(a.versao_numero),
        id_analise: num(a.id),
        link: `${origem}/biblioteca/voz/${a.id}`,
      })),
    ]);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Raio-X da Classe Creator";
  for (const [nome, linhas] of abas) {
    const ws = wb.addWorksheet(nome);
    const colunas = Object.keys(linhas[0] ?? {});
    ws.columns = colunas.map((c) => ({ header: c, key: c, width: Math.min(60, Math.max(12, c.length + 2)) }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    // Limite de célula do Excel: 32.767 caracteres.
    for (const l of linhas) ws.addRow(Object.fromEntries(Object.entries(l).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 32_000) : v])));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const agora = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="raio-x-sessao-${agora}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
