/*
 * Prompts do Dossiê — porte LITERAL de classificar_canal_haiku,
 * classificar_lote_eixo_b e emitir_veredito_sonnet (app.py).
 *
 * Sem dependências de Next/aliases: scripts/verificar-prompts.mts compara a
 * saída destas funções, caractere por caractere, com os f-strings do app.py.
 */
import { codigosConteudo, codigosProdutor, tipologiaParaPrompt } from "../tipologia.ts";
import { pyCorte, pyFixed, pyInt, pyMilhar, pyStr } from "../py.ts";
import { duracaoIsoParaSegundos, type ItemVideoApi } from "../youtube-util.ts";
import type { ExemploAncora } from "../lupa/prompt.ts";
import type { CanalApi, Sintomas } from "./sintomas.ts";

export const MODELO_CANAL = "claude-haiku-4-5";
export const MAX_TOKENS_CANAL = 800;
export const MODELO_LOTE_B = "claude-haiku-4-5";
export const MAX_TOKENS_LOTE_B = 4000;
export const MODELO_VEREDITO = "claude-sonnet-4-6";
export const MAX_TOKENS_VEREDITO = 1200;

/**
 * Bloco de exemplos validados do Dossiê (cabeçalho difere do da Lupa). "" sem
 * exemplos ou se algum tiver justificativa nula (no Python, `None[:80]` lança
 * TypeError engolido pelo try externo).
 */
export function montarExemplosCanal(exemplos: ExemploAncora[]): string {
  if (!exemplos.length) return "";
  if (exemplos.some((ex) => ex.justificativa === null || ex.justificativa === undefined)) return "";
  const linhas = exemplos.map((ex) => {
    const just = pyCorte(ex.justificativa as string, 80);
    return `- ${pyStr(ex.canal_nome)} → ${pyStr(ex.tipo_produtor)}${just ? ` [${just}]` : ""}`;
  });
  return "\n\nEXEMPLOS VALIDADOS PELO PESQUISADOR:\n" + linhas.join("\n");
}

/** f"{x:.2f}%" if x is not None else 'indisponível' */
const engajamento = (s: Sintomas) =>
  s.taxa_engajamento_mediana !== null && s.taxa_engajamento_mediana !== undefined
    ? `${pyFixed(s.taxa_engajamento_mediana, 2)}%`
    : "indisponível";

/** f"{dict or 'padrão'}" — dict vira repr do Python. */
const link = (s: Sintomas, padrao: string) => (s.link_externo_repetido ? pyStr(s.link_externo_repetido) : padrao);

// ---------------------------------------------------------------------------
// 1. Classificação do canal (Haiku)
// ---------------------------------------------------------------------------

export function montarPayloadCanal(canal: CanalApi, videos: ItemVideoApi[], s: Sintomas): string {
  const sn = canal.snippet ?? {};
  const st = canal.statistics ?? {};
  const amostra = videos
    .slice(0, 10)
    .map((v) => `  - [${duracaoIsoParaSegundos(v.contentDetails?.duration ?? "")}s] ${pyCorte(v.snippet.title, 120)}`)
    .join("\n");
  const descricao = "description" in sn ? (sn.description ?? "") : "(sem descrição)";

  // Python: f"{None:.2f}" lança TypeError → o Dossiê falha (ver classificar.ts).
  return `DADOS DO CANAL:
- Nome: ${sn.title ?? ""}
- Inscritos: ${pyMilhar(pyInt(st.subscriberCount))}
- Total de vídeos: ${pyMilhar(pyInt(st.videoCount))}
- Visualizações totais do canal: ${pyMilhar(pyInt(st.viewCount))}
- Data de criação: ${pyCorte(sn.publishedAt ?? "", 10)}
- País declarado: ${"country" in sn ? pyStr(sn.country) : "não declarado"}

DESCRIÇÃO DO CANAL (auto-narrativa):
${pyCorte(descricao, 2500)}

SINTOMAS ESTRUTURAIS DETECTADOS NOS ÚLTIMOS ${videos.length} VÍDEOS:
- Frequência: ${pyFixed(s.frequencia_videos_por_dia as number, 2)} vídeos/dia (se profissional, espera-se >0.5)
- Duração mediana: ${s.duracao_mediana_segundos}s (${pyFixed(s.duracao_mediana_segundos / 60, 1)}min)
- Taxa de engajamento mediana: ${engajamento(s)} (likes+comentários/views)
- % títulos padronizados (com [TAG] ou emoji inicial): ${pyFixed(s.pct_titulos_padronizados, 0)}%
- Link externo repetido nas descrições: ${link(s, "nenhum")}

AMOSTRA DOS 10 VÍDEOS MAIS RECENTES:
${amostra}
`;
}

export function montarPromptCanal(exemplosDinamicos: string): string {
  return `Você é um pesquisador especialista em Estudos de Plataforma, trabalhando para o Observatório Classe Creator. Classifique o CANAL abaixo usando a tipologia desenvolvida na pesquisa de Filipe Severo (PUCRS/FAMECOS, 2026).

==========
${tipologiaParaPrompt()}
==========

REGRAS ESPECIAIS PARA DOSSIÊ DE CANAL:
1. NÃO confie cegamente na auto-descrição do canal. Use os SINTOMAS ESTRUTURAIS
   como evidência primária da estrutura real de produção.
2. Canal com >0.5 vídeo/dia + descrições com equipe + links monetizados repetidos
   sugere PROFISSIONALIZAÇÃO mesmo que se apresente como "criador independente".
3. Se descrição cita CNPJ, agência, manager, "produzido por X", equipe de redação,
   ou site corporativo → é sinal FORTE de Produtora Digital, não YouTuber Profissional.

4. TESTE DECISIVO 1 — Substituição de Pessoa (Produtora vs. YouTuber):
   "Se essa pessoa saísse do canal, o canal continuaria existindo como marca?"
   - SIM → Produtora Digital
   - NÃO → YouTuber Profissional
   ATENÇÃO: Mesmo com persona famosa e centralizada, se há estrutura empresarial
   por trás com múltiplos canais coordenados → Produtora Digital.

5. TESTE DECISIVO 2 — Origem do conteúdo (Marca vs. Produtora vs. Instituição):
   "O conteúdo existe para divulgar algo que existe fora do YouTube?"
   - SIM → Marca Comercial (clube, empresa, jogo, produto)
   - NÃO, o conteúdo/evento existe para gerar audiência → Produtora Digital
   "A entidade regula ou governa uma atividade reconhecida socialmente?"
   - SIM → Instituição (federação, confederação, liga oficial)

6. EXEMPLOS VALIDADOS PELO PESQUISADOR (use como calibração obrigatória):

   PRODUTORA DIGITAL (mesmo tendo persona/rosto famoso):
   - Gaules → produtora_digital [ecossistema com múltiplos canais, empresa estruturada]
   - Enaldinho → produtora_digital [opera múltiplos canais como empresa, não só persona]
   - MrBeast → produtora_digital [100+ funcionários, múltiplos canais, empresa global]
   - Mark Rober → produtora_digital [produtora de ciência com equipe grande]
   - BRKsEDU → produtora_digital [empresa educativa com múltiplos canais]
   - Gameplayrj → produtora_digital [empresa de games com múltiplos canais]
   - Flow Games → produtora_digital [sub-canal do ecossistema Flow — produtora]
   - Canal GOAT → produtora_digital [produtora nativa de esportes, não emissora]
   - VALORANT Esports BR → marca [Riot Games divulga o jogo via esports]
   - Kings League Brazil → produtora_digital [campeonato existe para gerar conteúdo]
   - Creative Squad → produtora_digital [coletivo sem persona central única]
   - Cortes do Inteligência [OFICIAL] → produtora_digital [derivado oficial de produtora]
   - Cortes do Manual do Mundo → produtora_digital [derivado oficial do Manual do Mundo]
   - Podcats → produtora_digital [marca de podcast, não persona individual]
   - Drauzio Varella → produtora_digital [canal médico institucionalizado com equipe]

   YOUTUBER PROFISSIONAL (persona individual mesmo com equipe grande):
   - Mendrake → youtuber_profissional [persona individual profissionalizada]
   - Tonigon → youtuber_profissional [criador individual, canal = pessoa]
   - Mauro Cezar → youtuber_profissional [jornalista individual, canal = persona]
   - rezendeevil → youtuber_profissional [persona individual de games]
   - T3ddy, só que Games → youtuber_profissional [canal derivado pessoal, não empresa]
   - Canal do Pirulla → youtuber_profissional [cientista individual, canal = persona]
   - NiinaSecrets → youtuber_profissional [criadora individual de lifestyle]
   - Emilly Vick → youtuber_profissional [criadora individual]

   MARCA COMERCIAL (clubes, empresas, jogos):
   - Flamengo TV → marca [canal oficial do clube — vende o clube, não governa esporte]
   - Botafogo TV → marca [canal oficial do clube]
   - TV CRUZEIRO → marca [canal oficial do clube]
   - Sport Club Internacional → marca [canal oficial do clube]
   - Santos Futebol Clube → marca [canal oficial do clube]
   - UFC Brasil → marca [divulga eventos UFC — produto comercial]
   - FORMULA 1 → marca [produto comercial global]
   - Netflix Brasil → marca [streaming divulgando catálogo]
   - Nintendo of America → marca [empresa de jogos divulgando produtos]
   - League of Legends Brasil → marca [Riot Games divulgando jogo]
   - Genshin Impact → marca [empresa divulgando jogo]

   INSTITUIÇÃO (entidades reguladoras e públicas):
   - CONMEBOL Sudamericana → instituicao [entidade reguladora do futebol sul-americano]
   - LALIGA EA SPORTS → instituicao [liga reguladora oficial]
   - Federação Catarinense de Futebol → instituicao [entidade reguladora regional]
   - Liga Brasileira de Futevôlei | LBF → instituicao [entidade reguladora de modalidade]
   - Volleyball World → instituicao [entidade reguladora mundial do vôlei]
   - TVE Bahia → instituicao [emissora pública estatal]
   - Fluminense Football Club → instituicao [clube com canal de caráter institucional]

7. Determine TAMBÉM qual tipo de conteúdo (Eixo B) é PREDOMINANTE no canal.

FORMATO: APENAS JSON válido:
{
  "tipo_produtor": "<código exato do Eixo A>",
  "tipo_conteudo_predominante": "<código exato do Eixo B>",
  "auto_classificacao": "<como o CANAL se apresenta (1 frase)>",
  "justificativa_tecnica": "<por que classificou assim, citando sintomas estruturais>"
}

CÓDIGOS Eixo A: ${codigosProdutor().join(", ")}
CÓDIGOS Eixo B: ${codigosConteudo().join(", ")}
${exemplosDinamicos}`;
}

// ---------------------------------------------------------------------------
// 2. Eixo B dos vídeos em lote (Haiku, chamada única)
// ---------------------------------------------------------------------------

export function montarPayloadLoteB(videos: ItemVideoApi[]): string {
  const blocos = videos.map((v, i) => {
    const sn = v.snippet ?? ({} as ItemVideoApi["snippet"]);
    const titulo = pyCorte(sn.title ?? "", 200);
    const descricao = pyCorte(sn.description ?? "", 300);
    const tags = (sn.tags ?? []).slice(0, 6).join(", ");
    let bloco = `[${i + 1}] TÍTULO: ${titulo}`;
    if (descricao) bloco += `\n    DESCRIÇÃO: ${descricao}`;
    if (tags) bloco += `\n    TAGS: ${tags}`;
    return bloco;
  });
  return `VÍDEOS A CLASSIFICAR:\n\n${blocos.join("\n\n")}`;
}

export function montarPromptLoteB(): string {
  return `Você é um classificador especialista em conteúdo audiovisual, operando o EIXO B da tipologia desenvolvida na pesquisa de Filipe Severo (PUCRS/FAMECOS, 2026).

Sua tarefa: classificar CADA UM dos vídeos abaixo em uma única categoria do Eixo B.

==========
${tipologiaParaPrompt()}
==========

REGRAS:
1. Retorne EXATAMENTE uma classificação por vídeo recebido.
2. Use SOMENTE os códigos válidos do Eixo B.
3. Use 'outros' apenas quando nenhuma outra categoria for aplicável.
4. Distinguir bem: "jogos" (videogame) é diferente de "esportivo" (futebol etc.).
5. "Vlog" tem narrativa pessoal/cotidiana; conteúdo roteirizado mesmo que pareça
   espontâneo é "entretenimento_roteirizado".

FORMATO DE SAÍDA: APENAS JSON válido, sem markdown:
{
  "classificacoes": [
    {"posicao": 1, "tipo_conteudo": "<código_eixo_b>"},
    {"posicao": 2, "tipo_conteudo": "<código_eixo_b>"},
    ...
  ]
}

CÓDIGOS VÁLIDOS Eixo B: ${codigosConteudo().join(", ")}
`;
}

// ---------------------------------------------------------------------------
// 3. Leitura final (Sonnet)
// ---------------------------------------------------------------------------

export type ClassificacaoCanal = {
  tipo_produtor: string;
  tipo_conteudo_predominante: string;
  auto_classificacao?: string;
  justificativa_tecnica?: string;
  justificativa_curta?: string;
};

export function montarPayloadVeredito(
  canal: CanalApi,
  classif: ClassificacaoCanal,
  s: Sintomas,
  relacionados: { snippet: { title: string } }[],
  aparicoesTermometro: number,
): string {
  const sn = canal.snippet ?? {};
  const st = canal.statistics ?? {};
  const rede = relacionados.length
    ? `Canais que este canal recomenda publicamente: ${relacionados
        .slice(0, 10)
        .map((c) => c.snippet.title)
        .join(", ")}`
    : "Nenhum canal relacionado declarado publicamente.";

  return `ANÁLISE DE CANAL DO YOUTUBE — VEREDITO SOCIOLÓGICO

NOME: ${sn.title ?? ""}
AUTO-DESCRIÇÃO (como o canal SE APRESENTA):
${pyCorte(sn.description ?? "", 2000)}

CLASSIFICAÇÃO TÉCNICA INFERIDA:
- Tipo de produtor: ${classif.tipo_produtor}
- Tipo de conteúdo predominante: ${classif.tipo_conteudo_predominante}
- Como o canal se posiciona (auto-classificação): ${"auto_classificacao" in classif ? pyStr(classif.auto_classificacao) : ""}

EVIDÊNCIAS ESTRUTURAIS:
- ${pyMilhar(pyInt(st.subscriberCount))} inscritos | ${pyMilhar(pyInt(st.videoCount))} vídeos totais
- Frequência: ${pyFixed(s.frequencia_videos_por_dia as number, 2)} vídeos/dia
- Duração mediana: ${pyFixed(s.duracao_mediana_segundos / 60, 1)} minutos
- Taxa de engajamento mediana: ${engajamento(s)} (likes+comentários/views)
- ${pyFixed(s.pct_titulos_padronizados, 0)}% dos títulos têm formatação padronizada
- Link externo repetido: ${link(s, "nenhum identificado")}

REDE DECLARADA:
${rede}

PRESENÇA HISTÓRICA NO TRENDING BRASIL:
Este canal apareceu ${aparicoesTermometro} vez(es) nos snapshots do Termômetro do Observatório.
`;
}

export const PROMPT_VEREDITO = `Você é um assistente de pesquisa que ajuda pesquisadores a identificar
tensões, contradições e pontos de atenção em canais do YouTube.

Seu papel NÃO é concluir, julgar intenções ou fazer diagnósticos fechados.
Seu papel É apontar o que merece atenção, o que é contraditório e o que exige
investigação qualitativa humana para ser interpretado.

O texto deve ser organizado em TRÊS BLOCOS com cabeçalhos simples:

**O que chama atenção**
Aponte tensões entre a auto-narrativa do canal e os dados estruturais.
Não interprete intenções — descreva contradições observáveis.
Ex: "A frequência X é estruturalmente incompatível com Y. Ao mesmo tempo, o canal se
apresenta como Z. Essa tensão entre discurso e estrutura merece atenção."

**O que investigar**
Liste perguntas concretas que o pesquisador deveria buscar responder.
Baseie-se nos dados disponíveis (links externos, rede de canais, frequência, duração).
Ex: "A presença de X em Y descrições sugere Z — vale verificar se há produtos pagos
associados." Nunca afirme — sempre sugira o que verificar.

**O que os dados não respondem**
Seja explícito sobre os limites da análise automatizada.
Indique o que só análise qualitativa humana pode responder.
Ex: "Se o volume reflete produção profissional ou acúmulo histórico."
"Se o engajamento é fidelização de nicho ou vínculo parassocial."

REGRAS:
- NÃO conclua. NÃO julgue intenções. NÃO psicologize o produtor.
- NÃO use frases como "a fachada encobre", "estratégia deliberada", "encenação".
- Use linguagem de investigação: "sugere", "pode indicar", "merece verificação",
  "é compatível com", "contrasta com", "levanta a questão de".
- NÃO repita números que já aparecem nos cards — referencie-os brevemente.
- Máximo de 4 parágrafos no total. Seja conciso.
- NÃO mencione a dissertação, o pesquisador ou a PUCRS.
`;
