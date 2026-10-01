/*
 * Prompt da Voz da Base — porte LITERAL de DIMENSOES_VOZ e
 * analisar_comentarios_sonnet (app.py).
 *
 * Sem dependências de Next/aliases: scripts/verificar-prompts.mts compara a
 * saída destas funções, caractere por caractere, com os f-strings do app.py.
 * Os nomes/descrições em PT são os do prompt; a interface usa as traduções
 * em messages (Voz.dimensoes.<codigo>).
 */
import { pyCorte, pyStr } from "../py.ts";

export const MODELO_VOZ = "claude-sonnet-4-6";
export const MAX_TOKENS_VOZ = 8000;
export const COMENTARIOS_POR_ANALISE = 100;

// Ordem das chaves = ordem do dict do Python (vale para o prompt e para a interface).
export const DIMENSOES_VOZ: Record<string, { nome: string; descricao: string }> = {
  publico_patrao: {
    nome: "Público-patrão",
    descricao:
      "Comentários que cobram produtividade, exigem ritmo industrial, comparam com outros criadores ou reclamam de demora. Operam o criador como funcionário.",
  },
  comunidade_afetiva: {
    nome: "Comunidade afetiva",
    descricao: "Comentários de apoio, parasocialidade positiva, declarações de admiração, formação de vínculo emocional com o criador.",
  },
  disputa_politica: {
    nome: "Disputa política/ideológica",
    descricao: "Comentários que polemizam, debatem, marcam posicionamento ideológico, ou tomam o vídeo como pretexto para alinhamento.",
  },
  trabalho_invisivel_fa: {
    nome: "Trabalho invisível do fã",
    descricao:
      "Comentários que defendem o criador de críticas, fazem propaganda voluntária, recrutam novos espectadores, atuam como guarda-pretoriana.",
  },
  toxico_abusivo: {
    nome: "Tóxico/abusivo",
    descricao: "Assédio, ódio direcionado, ataques pessoais, discurso discriminatório, agressões.",
  },
  negociacao_sentido: {
    nome: "Negociação de sentido",
    descricao:
      "Comentários que interpretam coletivamente o conteúdo, discutem significado, oferecem leituras alternativas, complementam ou corrigem informações.",
  },
};

export type Comentario = {
  id: string;
  autor: string;
  texto: string;
  likes: number;
  data: string;
  respostas: number;
};

/** Contexto do dossiê do canal (db.buscar_dossie_canal_existente). */
export type DossieContexto = {
  classificacao_sociologica?: string | null;
  tipo_conteudo_predominante?: string | null;
};

export function montarPromptVoz(): string {
  const descricoesDim = Object.entries(DIMENSOES_VOZ)
    .map(([cod, d]) => `- '${cod}' (${d.nome}): ${d.descricao}`)
    .join("\n");
  return `Você é um analista sociológico operando o referencial teórico-metodológico desenvolvido por Filipe Severo na dissertação 'O Novo "You" do YouTube' (PUCRS/FAMECOS, 2026), aplicando-o agora à análise QUALITATIVA dos comentários públicos de um vídeo do YouTube.

Sua tarefa:
1. CLASSIFICAR cada comentário em uma ou mais das 6 dimensões abaixo (multi-rótulo).
   Um comentário pode pertencer a 0, 1 ou várias dimensões simultaneamente.
2. CALCULAR o "Índice de Pressão Produtiva" — percentual de comentários
   classificados como 'publico_patrao'.
3. PRODUZIR síntese qualitativa em prosa interpretativa (3-5 parágrafos).
4. IDENTIFICAR a contradição estrutural, se houver, entre o que o canal entrega
   e o que o público pede.

DIMENSÕES ANALÍTICAS:
${descricoesDim}

REGRAS DE CLASSIFICAÇÃO:
- Comentários puramente neutros ou sem conteúdo classificável recebem dimensions=[]
- Multi-rótulo é a regra, não exceção: '😍 amo!! posta mais!' = ['comunidade_afetiva', 'publico_patrao']
- Atenção a IRONIA, SARCASMO, MEMES regionais brasileiros
- Não confunda crítica construtiva com toxicidade
- Defesa do criador contra haters = 'trabalho_invisivel_fa'
- "Cadê o vídeo nóvo?", "tá demorando" = 'publico_patrao'
- "Posta mais!", "queremos parte 2" = 'publico_patrao'

REGRAS DE VOZ NA SÍNTESE QUALITATIVA — CRÍTICAS:
- NÃO escreva em primeira pessoa ("eu observo", "concluo", "minha análise").
- NÃO se identifique como Filipe Severo, nem se apresente como autor humano.
- Use construções impessoais ou em terceira pessoa: "os dados sugerem", "a análise
  qualitativa revela", "configura-se", "observa-se que".
- O texto será apresentado ao leitor com aviso explícito de que foi gerado por LLM.
  Sua função é SINTETIZAR ANALITICAMENTE, não simular autoria humana.

FORMATO DA RESPOSTA: APENAS JSON válido, sem markdown:
{
  "classificacoes": [
    {"id": 1, "dimensoes": ["publico_patrao", "comunidade_afetiva"]},
    {"id": 2, "dimensoes": ["toxico_abusivo"]},
    ...
  ],
  "indice_pressao_produtiva": <float 0-100, % de comentários com 'publico_patrao'>,
  "sintese_qualitativa": "<3-5 parágrafos analíticos em PROSA IMPESSOAL, sem markdown nem bullets, conectando achados à tese sobre 'broadcast to you', plataformização e captura do trabalho criativo. Tom rigoroso, direto, politicamente consciente. Identifique padrões dominantes, vozes minoritárias relevantes e tensões.>",
  "contradicao_estrutural": "<se houver dossiê do canal: 1-2 parágrafos em prosa impessoal identificando o gap entre o que o canal entrega e o que o público pede; se não houver dossiê: string vazia ''>"
}

NÃO classifique mais comentários do que recebeu. NÃO invente IDs.
`;
}

/** f"{d.get(chave, padrao)}": ausente → padrão; presente e nulo → "None". */
const campo = (d: DossieContexto, chave: keyof DossieContexto, padrao: string) => (chave in d ? pyStr(d[chave]) : padrao);

export function montarPayloadVoz(tituloVideo: string, canalNome: string, comentarios: Comentario[], dossie: DossieContexto | null): string {
  const comentariosTxt = comentarios
    .map((c, i) => `[${i + 1}] (👍 ${c.likes}) @${c.autor}: ${pyCorte(c.texto, 600)}`)
    .join("\n\n");

  let contextoDossie = "";
  if (dossie) {
    contextoDossie = `

CONTEXTO ESTRUTURAL DO CANAL (do Dossiê já realizado):
- Classificação sociológica: ${campo(dossie, "classificacao_sociologica", "desconhecida")}
- Tipo de conteúdo predominante: ${campo(dossie, "tipo_conteudo_predominante", "desconhecido")}

USE este contexto para identificar CONTRADIÇÃO ESTRUTURAL — quando o público
exige do canal um ritmo/qualidade que não corresponde à sua estrutura real.
Por exemplo: público cobrando ritmo industrial de canal classificado como
'criador casual' = contradição estrutural relevante.
`;
  }

  return `VÍDEO ANALISADO: "${tituloVideo}"
CANAL: ${canalNome}
TOTAL DE COMENTÁRIOS: ${comentarios.length}
${contextoDossie}

COMENTÁRIOS NUMERADOS (analise TODOS):

${comentariosTxt}
`;
}
