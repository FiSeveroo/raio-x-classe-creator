import "server-only";

/*
 * YouTube Data API v3 — porte de app.py (extrair_video_id,
 * duracao_iso_para_segundos, _detectar_short, buscar_metadados_video,
 * buscar_metadados_canal). Mesmos endpoints, `part`s e campos.
 */

const API = "https://www.googleapis.com/youtube/v3";

/** Erro previsto da Lupa, com código para a mensagem traduzida na interface. */
export class ErroLupa extends Error {
  constructor(
    public codigo: "video_nao_encontrado" | "codigo_invalido",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** app.py: extrair_video_id — mesma ordem de padrões. */
export function extrairVideoId(url: string): string | null {
  const padroes = [
    /(?:v=|\/)([0-9A-Za-z_-]{11}).*/,
    /youtu\.be\/([0-9A-Za-z_-]{11})/,
    /shorts\/([0-9A-Za-z_-]{11})/,
    /embed\/([0-9A-Za-z_-]{11})/,
  ];
  for (const p of padroes) {
    const m = url.match(p);
    if (m) return m[1];
  }
  const limpo = url.trim();
  return /^[0-9A-Za-z_-]{11}$/.test(limpo) ? limpo : null;
}

/** app.py: duracao_iso_para_segundos — ISO 8601 (PT1H30M45S) → segundos. */
export function duracaoIsoParaSegundos(duracaoIso: string): number {
  const m = (duracaoIso || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [h, min, s] = m.slice(1).map((g) => (g ? Number(g) : 0));
  return h * 3600 + min * 60 + s;
}

type ItemVideo = {
  snippet: {
    title: string;
    description?: string;
    tags?: string[];
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails: { duration: string };
  player?: { embedWidth?: string | number; embedHeight?: string | number };
};

/**
 * app.py: _detectar_short. Regra validada: duração ≤ 180s + player vertical.
 * true = Short, false = longo, null = inconclusivo (sem dimensões).
 */
function detectarShort(item: ItemVideo, duracaoSegundos: number): boolean | null {
  if (duracaoSegundos > 180) return false;
  const w = item.player?.embedWidth;
  const h = item.player?.embedHeight;
  if (w == null || h == null) return null;
  const nw = Number(w);
  const nh = Number(h);
  if (!Number.isFinite(nw) || !Number.isFinite(nh)) return null;
  return Math.trunc(nh) > Math.trunc(nw);
}

/** Campos na MESMA ORDEM do dict Python — o JSON gravado em metadados_json segue esta ordem. */
export type MetaVideo = {
  video_id: string;
  titulo: string;
  descricao: string;
  tags: string[];
  canal_id: string;
  canal_nome: string;
  data_publicacao: string;
  duracao_iso: string;
  duracao_segundos: number;
  visualizacoes: number;
  likes: number;
  comentarios: number;
  is_short: boolean | null;
};

export type MetaCanal =
  | {
      canal_descricao: string;
      inscritos: number;
      total_videos: number;
      total_views: number;
    }
  | Record<string, never>;

function chave(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY não configurada.");
  return k;
}

async function getJson(caminho: string, params: Record<string, string>) {
  const url = new URL(`${API}/${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", chave());
  // Equivalente ao timeout=10 do requests.
  const resp = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (!resp.ok) throw new Error(`YouTube API respondeu ${resp.status}`);
  return resp.json();
}

/** app.py: buscar_metadados_video */
export async function buscarMetadadosVideo(videoId: string): Promise<MetaVideo> {
  const data = await getJson("videos", {
    id: videoId,
    part: "snippet,statistics,contentDetails,player",
    maxWidth: "1920", // necessário para embedWidth/embedHeight virem com aspecto real
  });
  const item: ItemVideo | undefined = data.items?.[0];
  if (!item) {
    throw new ErroLupa("video_nao_encontrado", "Vídeo não encontrado. Verifique se a URL está correta e se o vídeo é público.");
  }
  const duracaoIso = item.contentDetails.duration;
  const duracaoSeg = duracaoIsoParaSegundos(duracaoIso);
  return {
    video_id: videoId,
    titulo: item.snippet.title,
    descricao: item.snippet.description ?? "",
    tags: item.snippet.tags ?? [],
    canal_id: item.snippet.channelId,
    canal_nome: item.snippet.channelTitle,
    data_publicacao: item.snippet.publishedAt,
    duracao_iso: duracaoIso,
    duracao_segundos: duracaoSeg,
    visualizacoes: Number(item.statistics.viewCount ?? 0),
    likes: Number(item.statistics.likeCount ?? 0),
    comentarios: Number(item.statistics.commentCount ?? 0),
    is_short: detectarShort(item, duracaoSeg),
  };
}

/** app.py: buscar_metadados_canal — {} se o canal não for encontrado (como no Python). */
export async function buscarMetadadosCanal(canalId: string): Promise<MetaCanal> {
  const data = await getJson("channels", { id: canalId, part: "snippet,statistics" });
  const item = data.items?.[0];
  if (!item) return {};
  return {
    canal_descricao: item.snippet?.description ?? "",
    inscritos: Number(item.statistics?.subscriberCount ?? 0),
    total_videos: Number(item.statistics?.videoCount ?? 0),
    total_views: Number(item.statistics?.viewCount ?? 0),
  };
}
