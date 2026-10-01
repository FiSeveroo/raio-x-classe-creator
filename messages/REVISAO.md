# Revisão de textos — Fase 1

Fonte do PT: texto integral do `app.py` (a planilha corta textos longos na primeira linha).
Fonte do EN/ES: `TEXTOS_RAIOX_PARA_TRADUZIR.xlsx` **quando o texto existe lá**. O resto foi traduzido pelo Claude e precisa de revisão antes do lançamento internacional.

## Traduções escritas pelo Claude (revisar EN e ES)

| Onde | Chaves |
|---|---|
| `messages/*.json` | `Meta.descricao` |
| | `Home.heroTexto`, `Home.contadores.*`, `Home.modulosTexto`, `Home.quandoUsar`, `Home.abrirModulo` |
| | `Home.metodologiaTexto`, `Home.eixoAPergunta`, `Home.eixoBPergunta`, `Home.categorias` |
| | `Home.bibliotecaTexto`, `Home.bibliotecaCard*`, `Home.bibliotecaSnapshot*`, `Home.bibliotecaBotao` |
| | `Home.agendaTexto`, `Home.agendaPergunta/Hipotese/Metodo`, `Home.concluidasTexto`, `Home.citarTexto`, `Home.copiar/copiado` |
| | `Modulos.*` — descrição dos 5 módulos (inteiro) |
| | `Agenda` — as 10 pesquisas sugeridas (inteiro) |
| | `Concluidas` — resumo e achados da dissertação |
| | `Faq[].resposta` — a planilha só tinha a primeira linha de cada resposta |
| | `Sobre.observatorioTexto` — não estava na planilha |
| | `Biblioteca.texto`, `Biblioteca.*.legenda` (parte), `Biblioteca.colunas.*`, `Biblioteca.analiseVideo`, `Biblioteca.historicoTitulo`, `Biblioteca.atual`, `Biblioteca.verNoYoutube`, `Biblioteca.naoEncontrada` |
| | `Comum.*` (textos novos: "sem dados", aviso de banco, rodapé, 404) |
| `src/lib/tipologia.ts` | `nome.en/es` e `definicao.en/es` das 20 categorias — **metodologicamente sensível**, vale revisão de quem conhece a dissertação |

Termos técnicos mantidos no original: endpoint, trending, snapshot, Shorts, `mostPopular`, códigos da tipologia (`entretenimento_roteirizado` etc.).

## Decisões de texto para confirmar

1. **"Observatório" não traduzido.** A planilha traduz para "Classe Creator Observatory" / "Observatorio Classe Creator", mas o CLAUDE.md (princípio 8) e o próprio índice da planilha dizem para manter a marca. Segui o princípio: "Observatório Classe Creator" em todos os idiomas.
2. **Privacidade (PT) — reCAPTCHA → Cloudflare Turnstile.** O texto do Streamlit ainda cita reCAPTCHA/Google, mas o app usa Turnstile desde a troca. Corrigi no PT (a planilha já trazia Turnstile em EN/ES).
3. **Termômetro: resolvido.** Coleta 2x/dia (confirmado pelo Filipe e nos workflows); texto corrigido nos 3 idiomas.
4. **Nomes dos módulos em EN/ES** seguem a planilha: The Magnifier, Trending Thermometer, Narrative Dispute, Channel Dossier, Voice of the Base / La Lupa, Termómetro del En Alta, Disputa de Narrativa, Dossier del Canal, Voz de la Base.
5. **Justificativas do Claude** (vindas do banco) aparecem sempre em PT, marcadas com `lang="pt-BR"`, em qualquer idioma da interface. Traduzir isso seria gerar dado novo — fora do escopo.

## Lupa (Fase 2) — 1/out/2026

Traduções escritas pelo Claude (revisar EN/ES): `Lupa.intro` (a planilha corta na primeira linha), `Lupa.sessao`, `Lupa.restantes`, `Lupa.existenteRotulo/existenteTexto`, `Lupa.avisoCusto`, `Lupa.erros.*` (exceto `url_invalida`), `Analise.nova`, `Analise.short/longo`, `Analise.eixoA/eixoB`, `Analise.novaAnaliseLupa`. O resto de `Lupa` e `Analise` vem da planilha.

Comportamentos herdados do Streamlit, mantidos de propósito (mudar = decisão metodológica do Filipe):
1. **URL "solta" vira ID**: a regra de extração lê 11 caracteres depois de qualquer "/" como ID (ex.: `classecreator.com` → "classecreat"). O usuário vê "vídeo não encontrado" e nenhum slot é gasto, mas uma consulta (1 unidade de cota) vai ao YouTube.
2. **Exemplo de âncora com justificativa nula** descarta TODOS os exemplos dinâmicos do prompt (no Python, `None[:80]` gera erro engolido em silêncio). Hoje `canais_validados` está vazia, então não há efeito prático.
3. **Âncora validada** devolve sempre `tipo_conteudo = "outros"` quando o canal validado não tem conteúdo definido.

Diferenças deliberadas em relação ao Streamlit:
- Sem cache SQLite local (era efêmero); o corpus do Supabase é o cache.
- **Atualizar consome o peso da versão (1, 2, 4, 8…)**, como a interface do Streamlit anunciava; lá a Lupa descontava sempre 1. Confirmar com o Filipe.
- Limite por sessão guardado num cookie de sessão (sem dado pessoal); no Streamlit, recarregar a página zerava o contador.
- Se a gravação no banco falha, a análise não é exibida (o resultado vive numa URL do corpus). No Streamlit, a falha de gravação era silenciosa.
- Turnstile ainda não ativo (Fase 3).

## Dossiê, Termômetro, Disputa e Voz da Base (Fase 2) — 1/out/2026

Traduções escritas pelo Claude (revisar EN/ES): tudo em `Dossie`, `DossieResultado`, `Termometro`, `Disputa`, `DisputaResultado`, `Voz` e `VozResultado` que não está nas abas da planilha (a planilha só tem a primeira linha dos textos longos e não tem os textos novos da interface). Os nomes das 6 dimensões da Voz em EN/ES (`Voz.dimensoes.*`: "Audience-as-boss", "Invisible fan labor"…) são **metodologicamente sensíveis**.

Prompts: `npm run verificar` confere, caractere por caractere, os prompts de Lupa, Dossiê (3 chamadas), Disputa e Voz da Base contra o `app.py`, além do modelo e do max_tokens de cada chamada.

### Diferenças deliberadas (confirmar)
- **Slot só é descontado quando a análise é gravada** (Dossiê, Disputa, Voz). No Streamlit, o slot era gasto antes do pipeline, mesmo se falhasse.
- **Termômetro e linha de base da Disputa usam o corpus inteiro.** O `db.py` pedia `limit(5000)`, mas o Supabase devolve no máximo 1.000 linhas por consulta: o Streamlit enxergava só os ~2 últimos snapshots na série temporal, nos canais, na exportação e na linha de base da Disputa.
- **Só vídeos classificados entram nas composições.** Com a classificação pausada no coletor, 249 de ~130 mil vídeos do Termômetro estão classificados (snapshots 23–28). No Streamlit, `nao_classificado` entrava no denominador da linha de base da Disputa.
- **Qui-quadrado da Disputa:** a regra "mínimo 10 coletas" conta só coletas com vídeos classificados (hoje 6 → leitura preliminar). O Streamlit contava todas (99+) e rodava o teste sobre a base quebrada.
- **Disputa — falha de classificação:** item que falha é tentado de novo uma vez; se ainda falhar, vira "outros" com a justificativa "Falha na classificação automática" (como no Python). Se TODOS falharem, nada é gravado (o Python gravaria 50 "outros").
- **Disputa — classificações em paralelo (8 por vez):** mesmo prompt e mesmo resultado; ~20 s em vez de ~2 min.
- **Voz — conferência do IPP:** o índice exibido continua sendo o valor que o modelo informa (como no Streamlit); abaixo dele aparece a contagem conferível (comentários marcados como público-patrão / total).
- **Voz — notas éticas visíveis** na página do módulo (no Streamlit ficavam num expansor fechado).

### Comportamentos herdados, mantidos de propósito
- Disputa: as prevalências de referência para "ausências relevantes" são as da dissertação (fixas, n=1.049), não o corpus vivo; P(ausência) usa sempre amostra de 50.
- Disputa: os termos sugeridos ficam em português nos 3 idiomas (a busca é no YouTube BR, `relevanceLanguage=pt`).
- Voz: a calibração do IPP por percentis usa TODAS as análises gravadas, inclusive versões não canônicas (`buscar_distribuicao_ipps` não filtra).
- Voz: o JSON de comentários guarda o nome público do autor (`@autor`), como no Streamlit, e a tela mostra.
- Voz: o YouTube hoje devolve o autor já com "@" (handle), então o prompt (idêntico ao Python) mostra "@@nome" ao Sonnet. Inofensivo, mas é um ajuste de prompt a decidir. Na tela, o "@" duplicado é removido.

### Achado para olhar com calma
- A linha de base classificada do Termômetro (249 vídeos) tem 6% de criador casual e 5,6% de usuário comum, enquanto o texto de "categorias estruturalmente extintas" (vindo do app.py) afirma que essas categorias não aparecem no trending. São classificações diferentes (dissertação × coletor), mas a tela da Disputa mostra as duas lado a lado.
