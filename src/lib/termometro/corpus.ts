import "server-only";
import { supabaseLeitura } from "@/lib/supabase/server";
import { codigosConteudo, codigosProdutor } from "@/lib/tipologia";

/*
 * Leitura do corpus do Termômetro (tabelas do coletor Python — SÓ LEITURA).
 *
 * Diferença deliberada em relação ao db.py: todos_videos_para_serie_temporal
 * pedia limit(5000), mas o Supabase devolve no máximo 1.000 linhas por
 * consulta — o Streamlit enxergava só os ~2 últimos snapshots. Aqui o corpus
 * é paginado por inteiro (intenção documentada no próprio db.py: "TODOS os
 * vídeos de TODOS os snapshots") e agregado em memória, com cache de 1 hora.
 *
 * Vídeos com tipo "nao_classificado" (coletas com CLASSIFICACAO_ATIVA=false)
 * NÃO entram nas composições pela tipologia; são contados à parte.
 */

const TTL_MS = 60 * 60 * 1000;
const PAGINA = 1000;
const PARALELO = 8;

export type Snapshot = {
  id: number;
  data_coleta: string;
  semana_ano: number | null;
  dia_semana: string | null;
  horario_coleta: string | null;
  total_videos_coletados: number | null;
  observacoes: string | null;
};

type LinhaAgregavel = {
  snapshot_id: number;
  tipo_produtor: string | null;
  tipo_conteudo: string | null;
  canal_id: string | null;
  canal_nome: string | null;
  is_short: boolean | null;
};

export type Agregados = {
  geradoEm: string;
  totalVideos: number;
  totalClassificados: number;
  snapshotsClassificados: number;
  /** Por snapshot: contagens por código (só classificados) e total do snapshot. */
  porSnapshot: Map<number, { total: number; classificados: number; produtor: Record<string, number>; conteudo: Record<string, number>; shorts: number; longos: number }>;
  /** Corpus inteiro, só classificados — linha de base da Disputa. */
  produtor: Record<string, number>;
  conteudo: Record<string, number>;
  /** Canais por número de aparições no corpus inteiro. */
  canais: { canal_id: string; canal_nome: string; tipo_produtor: string; aparicoes: number }[];
};

let cache: { valor: Agregados; expira: number } | null = null;
let emAndamento: Promise<Agregados> | null = null;

function db() {
  const c = supabaseLeitura();
  if (!c) throw new Error("Supabase não configurado.");
  return c;
}

export const ehClassificado = (codigo: string | null | undefined, eixo: "A" | "B") =>
  !!codigo && (eixo === "A" ? codigosProdutor() : codigosConteudo()).includes(codigo);

async function carregarTudo(): Promise<Agregados> {
  const { count, error } = await db().from("videos_snapshot").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  const paginas = [...Array(Math.ceil(total / PAGINA)).keys()];

  const porSnapshot: Agregados["porSnapshot"] = new Map();
  const produtor: Record<string, number> = {};
  const conteudo: Record<string, number> = {};
  const canais = new Map<string, { canal_id: string; canal_nome: string; tipo_produtor: string; aparicoes: number }>();
  let totalVideos = 0;
  let totalClassificados = 0;

  const somar = (linhas: LinhaAgregavel[]) => {
    for (const v of linhas) {
      totalVideos++;
      let s = porSnapshot.get(v.snapshot_id);
      if (!s) porSnapshot.set(v.snapshot_id, (s = { total: 0, classificados: 0, produtor: {}, conteudo: {}, shorts: 0, longos: 0 }));
      s.total++;
      if (v.is_short === true) s.shorts++;
      else if (v.is_short === false) s.longos++;

      const a = ehClassificado(v.tipo_produtor, "A");
      const b = ehClassificado(v.tipo_conteudo, "B");
      if (a) {
        s.classificados++;
        totalClassificados++;
        s.produtor[v.tipo_produtor!] = (s.produtor[v.tipo_produtor!] ?? 0) + 1;
        produtor[v.tipo_produtor!] = (produtor[v.tipo_produtor!] ?? 0) + 1;
      }
      if (b) {
        s.conteudo[v.tipo_conteudo!] = (s.conteudo[v.tipo_conteudo!] ?? 0) + 1;
        conteudo[v.tipo_conteudo!] = (conteudo[v.tipo_conteudo!] ?? 0) + 1;
      }
      if (v.canal_id) {
        const c = canais.get(v.canal_id);
        if (c) {
          c.aparicoes++;
          // Se alguma aparição do canal estiver classificada, mostra esse tipo.
          if (a) c.tipo_produtor = v.tipo_produtor!;
        } else {
          canais.set(v.canal_id, {
            canal_id: v.canal_id,
            canal_nome: v.canal_nome ?? v.canal_id,
            tipo_produtor: v.tipo_produtor ?? "nao_classificado",
            aparicoes: 1,
          });
        }
      }
    }
  };

  const fila = [...paginas];
  const trabalhar = async () => {
    while (fila.length) {
      const p = fila.shift()!;
      const { data, error: e } = await db()
        .from("videos_snapshot")
        .select("snapshot_id, tipo_produtor, tipo_conteudo, canal_id, canal_nome, is_short")
        .order("id")
        .range(p * PAGINA, p * PAGINA + PAGINA - 1);
      if (e) throw new Error(e.message);
      somar((data ?? []) as LinhaAgregavel[]);
    }
  };
  await Promise.all(Array.from({ length: PARALELO }, trabalhar));

  return {
    geradoEm: new Date().toISOString(),
    totalVideos,
    totalClassificados,
    snapshotsClassificados: [...porSnapshot.values()].filter((s) => s.classificados > 0).length,
    porSnapshot,
    produtor,
    conteudo,
    canais: [...canais.values()].sort((x, y) => y.aparicoes - x.aparicoes),
  };
}

/** Agregados do corpus inteiro, com cache em memória de 1 hora. */
export async function agregadosTermometro(): Promise<Agregados> {
  if (cache && cache.expira > Date.now()) return cache.valor;
  if (!emAndamento) {
    emAndamento = carregarTudo()
      .then((valor) => {
        cache = { valor, expira: Date.now() + TTL_MS };
        return valor;
      })
      .finally(() => {
        emAndamento = null;
      });
  }
  return emAndamento;
}

/** db.listar_snapshots — todos os snapshots, mais recente primeiro. */
export async function listarSnapshots(): Promise<Snapshot[]> {
  const { data, error } = await db().from("snapshots").select("*").order("data_coleta", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Snapshot[];
}

export type VideoSnapshot = {
  id: number;
  posicao_ranking: number | null;
  video_id: string;
  titulo: string | null;
  canal_id: string | null;
  canal_nome: string | null;
  visualizacoes: number | null;
  likes: number | null;
  comentarios: number | null;
  duracao_segundos: number | null;
  tipo_produtor: string | null;
  tipo_conteudo: string | null;
  categoria_coleta: string | null;
  is_short: boolean | null;
};

/** db.videos_do_snapshot — vídeos de uma coleta, por ranking. */
export async function videosDoSnapshot(snapshotId: number): Promise<VideoSnapshot[]> {
  const { data, error } = await db()
    .from("videos_snapshot")
    .select("id, posicao_ranking, video_id, titulo, canal_id, canal_nome, visualizacoes, likes, comentarios, duracao_segundos, tipo_produtor, tipo_conteudo, categoria_coleta, is_short")
    .eq("snapshot_id", snapshotId)
    .order("posicao_ranking", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as VideoSnapshot[];
}
