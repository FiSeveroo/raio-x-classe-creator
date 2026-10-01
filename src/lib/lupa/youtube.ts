import "server-only";
import {
  detectarShort,
  duracaoIsoParaSegundos,
  ErroPrevisto,
  youtubeGet,
  type ItemVideoApi,
} from "@/lib/youtube";

/*
 * YouTube na Lupa — porte de app.py (extrair_video_id, buscar_metadados_video,
 * buscar_metadados_canal). Mesmos endpoints, `part`s e campos.
 */

export { ErroPrevisto as ErroLupa };

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

/** app.py: buscar_metadados_video */
export async function buscarMetadadosVideo(videoId: string): Promise<MetaVideo> {
  const data = await youtubeGet<{ items?: ItemVideoApi[] }>("videos", {
    id: videoId,
    part: "snippet,statistics,contentDetails,player",
    maxWidth: 1920, // necessário para embedWidth/embedHeight virem com aspecto real
  });
  const item = data.items?.[0];
  if (!item) {
    throw new ErroPrevisto(
      "video_nao_encontrado",
      "Vídeo não encontrado. Verifique se a URL está correta e se o vídeo é público.",
    );
  }
  const duracaoIso = item.contentDetails?.duration ?? "";
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
    visualizacoes: Number(item.statistics?.viewCount ?? 0),
    likes: Number(item.statistics?.likeCount ?? 0),
    comentarios: Number(item.statistics?.commentCount ?? 0),
    is_short: detectarShort(item, duracaoSeg),
  };
}

/** app.py: buscar_metadados_canal — {} se o canal não for encontrado (como no Python). */
export async function buscarMetadadosCanal(canalId: string): Promise<MetaCanal> {
  type ItemCanal = { snippet?: { description?: string }; statistics?: Record<string, string> };
  const data = await youtubeGet<{ items?: ItemCanal[] }>("channels", { id: canalId, part: "snippet,statistics" });
  const item = data.items?.[0];
  if (!item) return {};
  return {
    canal_descricao: item.snippet?.description ?? "",
    inscritos: Number(item.statistics?.subscriberCount ?? 0),
    total_videos: Number(item.statistics?.videoCount ?? 0),
    total_views: Number(item.statistics?.viewCount ?? 0),
  };
}
