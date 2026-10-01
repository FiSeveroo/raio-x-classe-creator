# Revisão de textos — Fase 1

Fonte do PT: texto integral do `app.py` (a planilha corta textos longos na primeira linha).
Fonte do EN/ES: `TEXTOS_RAIOX_PARA_TRADUZIR.xlsx` **quando o texto existe lá**. O resto foi traduzido pelo Claude e precisa de revisão antes do lançamento internacional.

## Traduções escritas pelo Claude (revisar EN e ES)

| Onde | Chaves |
|---|---|
| `messages/*.json` | `Meta.descricao` |
| | `EmMigracao.*` (texto novo, não existia no Streamlit) |
| | `Home.heroTexto`, `Home.contadores.*`, `Home.modulosTexto`, `Home.quandoUsar`, `Home.abrirModulo` |
| | `Home.metodologiaTexto`, `Home.eixoAPergunta`, `Home.eixoBPergunta`, `Home.categorias` |
| | `Home.bibliotecaTexto`, `Home.bibliotecaCard*`, `Home.bibliotecaSnapshot*`, `Home.bibliotecaBotao` |
| | `Home.agendaTexto`, `Home.agendaPergunta/Hipotese/Metodo`, `Home.concluidasTexto`, `Home.citarTexto`, `Home.copiar/copiado` |
| | `Modulos.*` — descrição dos 5 módulos (inteiro) |
| | `Agenda` — as 10 pesquisas sugeridas (inteiro) |
| | `Concluidas` — resumo e achados da dissertação |
| | `Faq[].resposta` — a planilha só tinha a primeira linha de cada resposta |
| | `Sobre.observatorioTexto` — não estava na planilha |
| | `Biblioteca.texto`, `Biblioteca.*.legenda` (parte), `Biblioteca.colunas.*`, `Biblioteca.detalheEmMigracao`, `Biblioteca.analiseVideo`, `Biblioteca.historicoTitulo`, `Biblioteca.atual`, `Biblioteca.verNoYoutube`, `Biblioteca.naoEncontrada` |
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
