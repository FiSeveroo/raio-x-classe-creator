/*
 * Prompt da Disputa — porte LITERAL de classificar_resultado_busca (app.py).
 *
 * Sem dependências de Next/aliases: scripts/verificar-prompts.mts compara a
 * saída destas funções, caractere por caractere, com os f-strings do app.py.
 */
import { codigosConteudo, codigosProdutor, tipologiaParaPrompt } from "../tipologia.ts";
import { pyCorte, pyInt, pyJsonDumps, pyMilhar } from "../py.ts";

export const MODELO_ITEM = "claude-haiku-4-5";
export const MAX_TOKENS_ITEM = 600;

// O bloco de exemplos é o mesmo do Dossiê (mesmo cabeçalho no app.py).
export { montarExemplosCanal as montarExemplosItem } from "../dossie/prompts.ts";

/** Item de search.list (vídeo, canal ou playlist). */
export type ItemBusca = {
  id: { kind: string; videoId?: string; channelId?: string; playlistId?: string };
  snippet: { title: string; description?: string; channelId?: string; channelTitle?: string };
};

type Estatisticas = { subscriberCount?: string; videoCount?: string; viewCount?: string };
export type DadosExtras = {
  video?: { statistics?: Estatisticas };
  canal?: { statistics?: Estatisticas; snippet?: { description?: string } };
};

const n = (v: unknown) => pyMilhar(pyInt(v ?? 0));

export function montarPayloadItem(item: ItemBusca, extras: DadosExtras): string {
  const tipo = item.id.kind.replace("youtube#", "");
  const sn = item.snippet;
  if (tipo === "video") {
    const sv = extras.video?.statistics ?? {};
    const sc = extras.canal?.statistics ?? {};
    return `TIPO DE ITEM: VÍDEO
- Título: ${sn.title}
- Canal: ${sn.channelTitle}
- Inscritos do canal: ${n(sc.subscriberCount)}
- Total de vídeos do canal: ${n(sc.videoCount)}
- Visualizações: ${n(sv.viewCount)}
- Descrição do canal: ${pyCorte(extras.canal?.snippet?.description ?? "", 1000)}
- Descrição do vídeo: ${pyCorte(sn.description ?? "", 1500)}
`;
  }
  if (tipo === "channel") {
    const sc = extras.canal?.statistics ?? {};
    return `TIPO DE ITEM: CANAL
- Nome do canal: ${sn.title}
- Inscritos: ${n(sc.subscriberCount)}
- Total de vídeos: ${n(sc.videoCount)}
- Descrição: ${pyCorte(sn.description ?? "", 2000)}
`;
  }
  return `TIPO DE ITEM: PLAYLIST
- Título: ${sn.title}
- Canal organizador: ${sn.channelTitle}
- Descrição: ${pyCorte(sn.description ?? "", 1500)}
`;
}

export function montarPromptItem(exemplos: string): string {
  return `Você é um pesquisador especialista em Estudos de Plataforma, trabalhando para o Observatório Classe Creator. Classifique o ITEM abaixo (que pode ser um vídeo, canal ou playlist do YouTube) usando a tipologia dupla desenvolvida na pesquisa de Filipe Severo (PUCRS/FAMECOS, 2026).

==========
${tipologiaParaPrompt()}
==========

REGRAS:
1. Escolha exatamente UMA categoria do Eixo A e UMA do Eixo B.
2. Categorias mutuamente exclusivas. Use "outros" só em último caso.
3. Para CANAIS e PLAYLISTS, classifique segundo a estrutura geral do produtor.
4. Justificativa SOCIOLÓGICA, não descritiva.
5. Se um canal tem nome de pessoa famosa de TV mas opera no YouTube como individual, prefira 'youtuber_profissional' apenas se há evidência de equipe e produção dedicada ao YouTube; caso contrário, 'midia_tradicional' se ainda mantém vínculo com emissora.

FORMATO: APENAS JSON válido, sem markdown:
{
  "tipo_produtor": "<código exato do Eixo A>",
  "tipo_conteudo": "<código exato do Eixo B>",
  "justificativa": "<2 a 4 frases analíticas>"
}

CÓDIGOS Eixo A: ${codigosProdutor().join(", ")}
CÓDIGOS Eixo B: ${codigosConteudo().join(", ")}
${exemplos}`;
}

/** json.dumps(dict) do Python para um dicionário plano {str: int}. */
export const pyJsonDict = (d: Record<string, number>) => pyJsonDumps(d);
