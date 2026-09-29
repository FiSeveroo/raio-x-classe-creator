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
3. **Termômetro: "coleta semanal" ou "2x/dia"?** O texto do módulo no `app.py` e o README dizem coleta *semanal*; o CLAUDE.md diz 2x/dia. Mantive o texto do app. Confirmar qual está certo.
4. **Nomes dos módulos em EN/ES** seguem a planilha: The Magnifier, Trending Thermometer, Narrative Dispute, Channel Dossier, Voice of the Base / La Lupa, Termómetro del En Alta, Disputa de Narrativa, Dossier del Canal, Voz de la Base.
5. **Justificativas do Claude** (vindas do banco) aparecem sempre em PT, marcadas com `lang="pt-BR"`, em qualquer idioma da interface. Traduzir isso seria gerar dado novo — fora do escopo.
