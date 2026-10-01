/*
 * app.py: SUGESTOES_BUSCA — termos curados pelo Observatório. Os termos ficam
 * em português em todos os idiomas: a busca é feita no YouTube Brasil
 * (regionCode BR, relevanceLanguage pt). Os nomes dos grupos são traduzidos
 * (Disputa.grupos.<chave>).
 */
export const SUGESTOES_BUSCA: { chave: string; termos: string[] }[] = [
  { chave: "trabalho", termos: ["entregador de aplicativo", "trabalho doméstico", "motorista uber", "home office", "CLT"] },
  { chave: "politica", termos: ["bolsa família", "saúde pública", "educação pública", "corrupção", "eleições"] },
  { chave: "territorio", termos: ["desmatamento", "agronegócio", "seca nordeste", "petróleo", "indígenas"] },
  { chave: "cultura", termos: ["funk", "axé", "periferia", "sertanejo", "k-pop brasil"] },
  { chave: "tecnologia", termos: ["inteligência artificial", "fake news", "redes sociais", "privacidade digital", "streaming"] },
];
