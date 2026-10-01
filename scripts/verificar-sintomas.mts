/*
 * Teste de calcularSintomasEstruturais (porte de app.py) com um conjunto de
 * vídeos montado à mão. Os valores esperados foram calculados seguindo o
 * código Python linha a linha (comentados abaixo).
 *
 * Uso: node scripts/verificar-sintomas.mts
 */
import { calcularSintomasEstruturais } from "../src/lib/dossie/sintomas.ts";
import type { ItemVideoApi } from "../src/lib/youtube-util.ts";

const v = (
  dur: string,
  data: string,
  titulo: string,
  desc: string,
  views: number,
  likes: number,
  coments: number,
  player?: { embedWidth: number; embedHeight: number },
): ItemVideoApi => ({
  id: titulo,
  snippet: { title: titulo, description: desc, channelId: "UC", channelTitle: "C", publishedAt: data },
  contentDetails: { duration: dur },
  statistics: { viewCount: String(views), likeCount: String(likes), commentCount: String(coments) },
  ...(player ? { player } : {}),
});

const videos = [
  // 30s + player vertical → Short; título com [TAG]; engajamento 10%
  v("PT30S", "2026-09-01T00:00:00Z", "[TAG] primeiro", "https://www.loja.com/a https://youtube.com/x", 1000, 50, 50, { embedWidth: 360, embedHeight: 640 }),
  // 600s → longo; título começa com emoji 🔥 (U+1F525); engajamento 5%
  v("PT10M", "2026-09-03T00:00:00Z", "🔥 segundo", "https://loja.com/b http://outra.com", 2000, 100, 0),
  // 120s sem player → inconclusivo; views 0 (fora do engajamento)
  v("PT2M", "2026-09-05T00:00:00Z", "terceiro normal", "https://outra.com e https://outra.com", 0, 0, 0),
  // 1200s → longo; " 【" casa ^\s*[【]; engajamento 1%
  v("PT20M", "2026-09-09T00:00:00Z", " 【quarto】", "https://loja.com/c", 400, 4, 0),
];
const canal = { id: "UC", statistics: { subscriberCount: "12345", videoCount: "678" } };

const esperado = {
  frequencia_videos_por_dia: 0.5, // 4 vídeos em 8 dias (01→09)
  frequencia_shorts_por_dia: null, // 1 Short só → _freq devolve None
  frequencia_longos_por_dia: 2 / 6, // 2 longos em 6 dias (03→09)
  duracao_mediana_segundos: 1200, // sorted([600,1200])[2//2]
  duracao_mediana_geral_segundos: 600, // sorted([30,600,120,1200])[4//2]
  total_shorts: 1,
  total_longos: 2,
  total_inconclusivos: 1,
  pct_shorts: 25,
  // loja.com 3 × outra.com 3 (youtube.com filtrado): empate → o primeiro visto
  link_externo_repetido: { dominio: "loja.com", n_aparicoes: 3 },
  pct_titulos_padronizados: 75, // 3 de 4
  taxa_engajamento_mediana: 5, // sorted([10,5,1])[3//2]
  inscritos: 12345,
  total_videos_canal: 678,
  n_videos_analisados: 4,
};

const obtido = calcularSintomasEstruturais(videos, canal);
const a = JSON.stringify(esperado);
const b = JSON.stringify(obtido);
if (a !== b) {
  console.error("✗ sintomas diferem\n  esperado:", a, "\n  obtido:  ", b);
  process.exit(1);
}
console.log("✓ sintomas estruturais: 15 indicadores e ordem das chaves iguais ao esperado pelo Python");
if (JSON.stringify(calcularSintomasEstruturais([], canal)) !== "{}") {
  console.error("✗ lista vazia deveria devolver {}");
  process.exit(1);
}
console.log("✓ sem vídeos → {} (como o Python)");
