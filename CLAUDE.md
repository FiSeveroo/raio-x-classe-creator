# CLAUDE.md — Raio-X da Classe Creator

Contexto completo do projeto para o Claude Code. Leia este arquivo sempre antes de fazer qualquer mudança.

@AGENTS.md

**Código legado (somente-leitura):** `../raio-x-classe-creator` — clone do Streamlit. Usar como referência para portar lógica de negócio, tipologia e prompts. NUNCA editar, commitar ou dar push nesse clone.

---

## O QUE É O PROJETO

**Raio-X da Classe Creator** é uma ferramenta open-source de auditoria algorítmica do YouTube Brasil, derivada da dissertação de mestrado de Filipe Severo (PUCRS/FAMECOS, 2026).

- **URL atual:** https://raiox.classecreator.com
- **Repo principal:** github.com/FiSeveroo/raio-x-classe-creator
- **Repo do coletor:** github.com/FiSeveroo/coletor-youtube
- **Braço institucional:** Observatório Classe Creator (núcleo de pesquisa da Classe Creator)
- **Contexto amplo:** Classe Creator é um projeto de pesquisa, formação e pensamento crítico sobre plataformização, fundado por Filipe Severo. Tagline: "A Revolução não cabe no feed."

---

## STACK ATUAL (a ser migrado)

- **Backend + Frontend:** Streamlit (Python), tudo num `app.py` de ~6500 linhas
- **Banco de dados:** Supabase (Postgres)
- **APIs externas:** YouTube Data API v3, Anthropic API (Claude Haiku 4.5 para classificação em batch, Claude Sonnet 4.6 para análises qualitativas)
- **Coletor automatizado:** Python + GitHub Actions (roda 2x/dia)
- **Auth/Anti-bot:** Cloudflare Turnstile (managed mode, com persistência 24h via localStorage)
- **Deploy:** Streamlit Cloud
- **Idioma atual:** Português (PT-BR)

---

## STACK ALVO DA MIGRAÇÃO

- **Frontend:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Manter Python para coletor + criar API routes Next.js para operações interativas (ou Server Actions)
- **Banco:** MANTER Supabase (não migrar dados, apenas trocar quem consome)
- **Auth/Anti-bot:** MANTER Cloudflare Turnstile
- **Deploy:** Vercel
- **Multi-idioma:** i18n nativo Next.js (PT + EN + ES)

---

## ARQUITETURA DA FERRAMENTA

A ferramenta tem **5 módulos de análise** + páginas institucionais:

### Módulos de análise

1. **A Lupa** (`/lupa`) — Análise de UM vídeo específico
   - Input: URL do YouTube
   - Processo: busca metadados via YouTube API, classifica com Claude Haiku na tipologia dupla
   - Output: classificação Eixo A (produtor) × Eixo B (conteúdo) + justificativa sociológica
   - Custo: ~1 chamada Anthropic Haiku

2. **Dossiê do Canal** (`/dossie`) — Análise de UM canal
   - Input: @handle ou URL do canal
   - Processo: busca 50 vídeos recentes, calcula sintomas estruturais (frequência, duração, padronização), classifica canal + conteúdo predominante, mapeia rede de canais recomendados
   - Output: perfil completo do canal com "leitura final" (contradição entre auto-apresentação e dados)
   - Custo: ~2-3 chamadas Anthropic Haiku + 1 Sonnet

3. **Termômetro do Em Alta** (`/termometro`) — Análise longitudinal do trending BR
   - Automatizado via GitHub Actions (2x/dia)
   - Coleta 13 endpoints: geral + 12 categorias válidas para BR
   - Frontend só EXIBE dados coletados (dashboards, séries temporais)
   - Aqui está o achado da **inauditabilidade estrutural** (ver seção abaixo)

4. **Disputa de Narrativa** (`/disputa`) — Auditoria de tema
   - Input: palavra-chave (ex: "reforma trabalhista")
   - Processo: busca YouTube, classifica os top ~30 resultados, compara com baseline do Termômetro
   - Output: quem ganhou visibilidade neste tema, quem ficou de fora (com chi-quadrado)

5. **Voz da Base** (`/voz`) — Análise qualitativa de comentários
   - Input: URL do vídeo
   - Processo: coleta 100 comentários (order=relevance), classifica em 6 dimensões via Sonnet
   - Output: distribuição por dimensão, síntese qualitativa, "contradição detectada" (comparando com dossiê do canal se existir)

### Páginas institucionais

- **Home** (`/`) — apresentação da ferramenta, tipologia, módulos, FAQ, agenda de pesquisa, como citar
- **Sobre** (`/sobre`) — sobre projeto, Observatório, Classe Creator, Filipe
- **Biblioteca de Pesquisa** (`/biblioteca`) — corpus longitudinal público (todas as análises canônicas)

---

## TIPOLOGIA DUPLA (o coração metodológico)

Toda a ferramenta classifica vídeos/canais em DOIS eixos independentes.

### EIXO A — PRODUTOR (quem produz?)

10 categorias (códigos EXATOS gravados no Supabase — conferidos no tipologia.py em 29/set/2026):
- `midia_tradicional` — Emissoras, jornais, grandes marcas de mídia
- `produtora_digital` — MCNs, produtoras nativas digitais, operando múltiplos canais
- `youtuber_profissional` — Criador individual profissionalizado
- `criador_casual` — Cria com regularidade mas não profissionaliza
- `usuario_comum` — Uploads esporádicos, sem projeto de canal
- `instituicao` — Governos, universidades, ONGs, entidades reguladoras
- `musico` — Artistas musicais e gravadoras
- `marca` — Empresas fora da mídia (inclui clubes esportivos)
- `reaproveitamento` — Republicação de conteúdo alheio
- `outros` — Casos residuais

### EIXO B — CONTEÚDO (que tipo de trabalho?)

10 categorias:
- `informativo`, `entretenimento_roteirizado`, `jogos`, `esportivo`, `musical`, `promocional`, `vlog`, `educativo`, `experimental`, `outros`

**IMPORTANTE:** A tipologia foi desenvolvida na dissertação. Fonte canônica: `tipologia.py` no repo legado. Porte em `src/lib/tipologia.ts` — rodar `npm run verificar:tipologia` depois de qualquer mudança em um dos dois (o coletor Python continua usando o `.py`).

---

## O ACHADO CIENTÍFICO: INAUDITABILIDADE ESTRUTURAL

O maior achado do projeto (e base do artigo para a Convergence, deadline abstract 1/out/2026):

**O endpoint `mostPopular` da YouTube Data API v3 NÃO é auditável de forma fidedigna.**

**Prova empírica:**
- 99 snapshots coletados entre maio-julho/2026
- 8.264 comparações individuais de video_id
- **100% de exclusão** entre endpoint geral e endpoints filtrados por categoria
- 12 categorias válidas para BR completamente ausentes do endpoint geral

Isso significa que qualquer pesquisa acadêmica que use `chart=mostPopular` sem filtro está estudando uma seleção algorítmica opaca, não "o que é popular no YouTube".

**Conceito cunhado:** *structural inauditability* — sistemas que se apresentam como uma coisa e fazem outra, e essa divergência só é detectável por teste empírico que a documentação não orienta.

---

## PRINCÍPIOS METODOLÓGICOS (INVIOLÁVEIS)

1. **Nunca inferir dados que não temos** — se não dá para saber, mostrar "sem dados"
2. **Auditabilidade primeiro** — todo cálculo precisa ser explicável e reproduzível
3. **Corpus público longitudinal** — todas as análises viram parte do corpus (não são efêmeras)
4. **Versionamento canônico** — análises repetidas de mesmo objeto criam novas versões, antiga preservada
5. **Zero coleta de dado pessoal do usuário** — sem nome, email, IP
6. **Transparência sobre limitações do algoritmo** — Voz da Base tem disclaimer explícito sobre modelo poder errar em ironia/regionalismo
7. **Termos técnicos preservados** em traduções (endpoint, mostPopular, Shorts)
8. **Marcas mantidas em todos os idiomas** (Raio-X, Classe Creator, Observatório)

---

## SISTEMA DE VERSIONAMENTO E CORPUS

- Cada análise tem `canonica = True/False` e `versao_numero`
- Análise nova de objeto existente:
  1. Marca versão atual como `canonica = False`
  2. Cria nova com `canonica = True` e `versao_numero + 1`
- Peso da atualização cresce exponencial: 1, 2, 4, 8 slots (protege orçamento coletivo)
- Cooldown de X dias entre atualizações do mesmo objeto

---

## LIMITES DE USO

**Por sessão de usuário:**
- Lupa: 15 análises
- Disputa: 3 buscas
- Dossiê: 5 dossiês
- Voz da Base: 5 análises

**Diários globais (todos os usuários somados):**
- Lupa: 80, Disputa: 30, Dossiê: 40, Voz: 25

Existe carrinho de sessão que agrupa análises feitas e permite exportar como XLSX ao final.

---

## DADOS SENSÍVEIS / SECRETS

O projeto precisa das seguintes variáveis de ambiente:

```
YOUTUBE_API_KEY=          # YouTube Data API v3
ANTHROPIC_API_KEY=        # Claude Haiku + Sonnet
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY= # Para leitura (frontend)
SUPABASE_SECRET_KEY=      # Para escrita (backend/coletor)
TURNSTILE_SITE_KEY=       # Cloudflare Turnstile pública
TURNSTILE_SECRET_KEY=     # Cloudflare Turnstile privada
SENHA_PAINEL_INTERNO=     # Senha simples para /termometro?painel
```

---

## IDENTIDADE VISUAL (Classe Creator)

Diretrizes confirmadas pelo Filipe em 29/set/2026. As cores do app Streamlit (#00E87A, #7B2FFF, #FF5C1A) estavam ERRADAS — não usar.

**UX/UI: redesenhar do zero.** O backend e a metodologia do Streamlit são para copiar fielmente; a interface NÃO. Não replicar layout, ordem de seções ou componentes do app.py só porque existiam — pensar a experiência de novo.

**Cores e papéis:**
- Fundo predominantemente escuro — `#0a0a0a` (superfícies `#111111`, `#1a1a1a`); texto `#F5F0E8`
- Verde `#27D337` — títulos de seções principais e botões (também Eixo A)
- Roxo `#560BF2` — blocos de seção amplos (fundo) e títulos secundários (também Eixo B)
- Laranja `#D36C27` — CTAs de impacto e avisos importantes

**Contraste (acessibilidade):** `#560BF2` sobre o fundo escuro tem contraste ~2,5:1 — não serve para texto pequeno. Usar o roxo como FUNDO de bloco (texto claro por cima, ~7:1) e o tom clareado `--cc-roxo-texto` quando o roxo precisar ser cor de texto. Botões verdes e laranjas levam texto escuro.

**Tema:** Dark mode profundo, obrigatório.

**Tipografia:**
- Títulos: Gunterz Black (licença comercial confirmada pelo Filipe; `public/Gunterz-Black.otf`, classe `font-display`)
- Corpo: DM Sans (`@fontsource-variable/dm-sans`)
- Rótulos: `label-caps` (DM Sans em caixa alta). Space Mono foi removida.

**Fonte única do design system (1/out/2026):** repositório `FiSeveroo/escola-classe-creator` (branch `main`). Copiados sem alteração: `src/app/globals.css` (até o bloco "RAIO-X — complementos"), `src/components/ui/*` (exceto `accordion` e `table`, adicionados pela CLI do shadcn no mesmo estilo), `src/components/brand/{Brand,Logo}.tsx`, `src/lib/utils.ts`, `public/brand/{logo,textura}.webp`, `public/Gunterz-Black.otf`. Ao mudar a identidade, mudar primeiro na Escola e recopiar.
- Usar: `SectionTitle` (títulos de seção), `BrandBlock` (bloco roxo com textura), `Button` (`variant="cta"` = laranja), `Eyebrow`, `Logo`; utilitários `font-display`, `label-caps`, `bg-textura`; cores só via classes `cc-*`.
- Proibido: hex solto no código (exceção: `src/lib/marca.ts`, espelho dos tokens para metadata/OG), outras fontes, logo recriado em texto, textura em ladrilho.

**Logo:** `public/brand/logo.webp` via `<Logo />`. Ícone do site (`src/app/icon.png`) gerado a partir dele.

**Estética:** Manifesto urbano-digital. Layout clínico, direto. Sem ornamentação.

---

## TEXTOS DO SITE

Existe uma planilha `TEXTOS_RAIOX_PARA_TRADUZIR.xlsx` com 286 textos do site organizados por módulo, já com traduções sugeridas em EN e ES. Usar como fonte da verdade para copy da nova versão.

---

## OBJETIVO DA MIGRAÇÃO (do Streamlit para Next.js)

**Por que migrar:**
1. Streamlit tem limitações visuais severas — CSS engessado, cara de "dashboard científico"
2. Mobile fica sofrível
3. SEO zero (Streamlit é invisível pro Google)
4. Cada interação recarrega a página inteira
5. Compartilhamento de análises específicas via URL não funciona bem

**Ganhos esperados:**
1. Design profissional real (nível de site institucional)
2. Mobile-first nativo
3. Links de análises viram cards ricos no Twitter/LinkedIn (Open Graph)
4. Multi-idioma (PT + EN + ES) via i18n nativo
5. Performance drasticamente melhor
6. Preparação para lançamento internacional (Digital Methods Initiative em Amsterdam, artigo Convergence)

**O que NÃO muda:**
- Backend do coletor (Python + GitHub Actions) permanece intocado
- Supabase (banco) permanece intocado — só troca quem consome
- Lógica de negócio (tipologia, classificação, cooldowns) preservada
- Prompts para Claude Haiku/Sonnet preservados

---

## CONTEXTOS ACADÊMICOS RELEVANTES

**Colaboradores/interlocutores atuais:**
- Prof. Gustavo Fischer (UFRGS/FABICO) — coautor do artigo Convergence
- Prof. Rafael Grohmann (Univ. Toronto) — orientador acadêmico, INCT Soberania Informacional
- Prof. André Pase (PUCRS/FAMECOS) — vai usar Raio-X em disciplina 2026/2
- Prof. Julice Salvagni (UFRGS) — políticas públicas
- Marcelo Alves (PUC-Rio/CondadoLab) — desenvolvimento metodológico
- Willian Araújo, Raquel Recuero (UFRGS) — métodos digitais
- Richard Rogers (Univ. Amsterdam / Digital Methods Initiative) — próximo contato pós-tradução

**Marcos temporais:**
- Out/2026: apresentação no 4S (Canadá)
- 1/out/2026: deadline abstract Convergence
- 13/nov/2026: apresentação Raio-X em aula do Fischer (turma Beiguelman)
- Nov/2026 em diante: lançamento internacional (após tradução EN + ES)

---

## PLANO SUGERIDO DE MIGRAÇÃO (para o Claude Code seguir)

### Fase 1 — Fundação
1. Criar projeto Next.js 16 com App Router + TypeScript
2. Instalar Tailwind, shadcn/ui, Supabase JS client, react-plotly.js ou Recharts
3. Configurar tema dark, cores Classe Creator, tipografia
4. Criar layout com sidebar responsiva
5. Configurar i18n (PT + EN + ES) usando next-intl
6. Conectar Supabase (leitura)
7. Portar páginas institucionais: Home, Sobre, Biblioteca

### Fase 2 — Módulos
8. Portar Lupa (API route para chamar YouTube + Anthropic)
9. Portar Dossiê (mais complexo, mais campos)
10. Portar Termômetro (dashboards com Recharts)
11. Portar Disputa
12. Portar Voz da Base

### Fase 3 — Fechamento
13. Integrar Cloudflare Turnstile (widget React + verificação server-side)
14. Sistema de carrinho de sessão + export XLSX
15. SEO + Open Graph tags para compartilhamento
16. Deploy Vercel + domínio raiox.classecreator.com
17. Testes E2E básicos
18. Comparação lado a lado com Streamlit antes de aposentar

### Estado (atualizar a cada fase)
- **Fase 1 — concluída**. Leitura do Supabase de produção testada em 1/out/2026 (contadores, 4 abas da Biblioteca, página e imagem OG de análise). Next.js 16 + next-intl (PT sem prefixo, /en, /es), tema, Home, Sobre, Biblioteca (4 abas, só leitura) e página por análise de vídeo (`/biblioteca/video/[id]`, com imagem Open Graph). Módulos da Fase 2 têm página provisória que aponta para o Streamlit.
- **Repaginada da UX (30/set–1/out/2026):** a barra lateral virou cabeçalho com painel "Módulos" + rodapé completo; Home reorganizada como narrativa (hero com CTA laranja, faixa do corpus, bloco roxo com as duas perguntas, módulos em linhas numeradas). Aguardando feedback do Filipe e o logo.
- **Git:** o código novo vive no branch `nextjs` do repo `FiSeveroo/raio-x-classe-creator` (histórico separado do Streamlit). NUNCA enviar para o `main`: lá rodam o Streamlit e os workflows agendados do coletor, do importador e da exportação semanal, que o GitHub só executa no branch padrão.
- **Fase 2 — Lupa portada (1/out/2026):** `src/lib/lupa/` (youtube, prompt, classificar, registro) + `src/app/[locale]/lupa/`. Resultado abre em `/biblioteca/video/[id]`. Testada de ponta a ponta com gravação real no corpus (registro 20). Fidelidade conferida por `npm run verificar` (tipologia + prompt idênticos ao app.py). Pendências e diferenças em `messages/REVISAO.md`.
- **Fase 2 — concluída em 1/out/2026:** os 5 módulos portados e testados com gravação real no Supabase. Dossiê (`src/lib/dossie/`, resultado em `/biblioteca/canal/[id]`), Termômetro (`src/lib/termometro/`, painel com senha e CSV em `/api/termometro/csv`), Disputa (`src/lib/disputa/`, resultado em `/biblioteca/tema/[id]`), Voz da Base (`src/lib/voz/`, resultado em `/biblioteca/voz/[id]`). Todas as abas da Biblioteca abrem a análise completa. `npm run verificar` confere tipologia, todos os prompts (Lupa, Dossiê ×3, Disputa, Voz) e sintomas contra o legado. Diferenças deliberadas e pendências de decisão em `messages/REVISAO.md`. Próximo: Fase 3 (Turnstile, carrinho/XLSX, deploy).
- **Fase 3 — em andamento (1/out/2026):** Turnstile e carrinho/XLSX prontos. Deploy: projeto NOVO na Vercel (conta Hobby "fiseveroo's projects"), Production Branch = `nextjs`, URL de teste `*.vercel.app`, indexação bloqueada (`PERMITIR_INDEXACAO`). O domínio `raiox.classecreator.com` continua no projeto `raiox-redirect` (repo `FiSeveroo/raiox-redirect`, redireciona para o Streamlit) até a virada: aí basta mover o domínio entre projetos (o `raiox-redirect` fica como rollback).
- Convenções: textos só em `messages/*.json` (markdown-lite `**negrito**` renderizado por `src/components/rico.tsx`); consultas ao banco só em `src/lib/corpus.ts`; traduções novas entram em `messages/REVISAO.md`.

**Gravação no banco durante a migração (decidido pelo Filipe em 1/out/2026):**
- Os módulos portados (Lupa em diante) PODEM gravar no Supabase de produção durante os testes, com a mesma lógica de versionamento do Streamlit. O corpus atual é considerado dado de teste.
- No lançamento, o corpus será ZERADO, EXCETO o Termômetro (`snapshots`, `videos_snapshot`), que é preservado. Nada de reset sem confirmação explícita do Filipe na hora, e com backup completo feito antes.
- NUNCA tocar nas tabelas do Termômetro a partir do Next.js (são do coletor Python).

**Fase atual = COLETA (decidido pelo Filipe em 1/out/2026):**
- O Raio-X hoje serve para coletar; os números analíticos serão refeitos no futuro. Corrigir erros de cálculo herdados do Streamlit sempre que aparecerem.
- **PROIBIDO classificar em massa os vídeos do Termômetro** (~130 mil "nao_classificado"). A pausa no coletor é proposital: não há verba. Não criar script, rota ou workflow que faça isso, nem reativar a flag do coletor.
- Textos de achados (ex.: "categorias estruturalmente extintas") vêm da dissertação, não do corpus atual — manter. Agenda futura: melhorar o algoritmo de verificação/classificação de canais.

**Backlog de algoritmos/módulos (ajustes futuros, depois do deploy completo — não mexer sem combinar com o Filipe):**
1. **Dossiê ignora a recência das postagens** (relatado pelo Filipe em 1/out/2026): a frequência (`_freq` no app.py, `frequencia()` em `src/lib/dossie/sintomas.ts`) mede só o intervalo entre o vídeo mais antigo e o mais recente da amostra de 50 — nunca compara com a data da análise. Canal parado há 1 ano aparece como ativo, e o prompt do Sonnet não recebe a informação. Ideia: sintoma "dias desde o último vídeo" (+ talvez frequência nos últimos 90 dias) no payload e na tela. Muda prompt validado → decisão metodológica.
2. Melhorar o algoritmo de verificação/classificação de canais (codificação atual não é 100% confiável; ver "Fase atual = COLETA").
3. Refazer os números analíticos quando houver verba e classificação melhor.
4. Conteúdo gerado pela IA (justificativas, leitura final, síntese) aparece em PT também em /en e /es (prompts e corpus em PT, marcado `lang="pt-BR"`). Traduzir = gerar dado novo → decidir antes do lançamento internacional.
5. Exportação semanal pública (`exportador_corpus.py`, repo legado) corta `videos_snapshot` em 50.000 linhas (`max_registros=50000`); o corpus já tem ~131 mil. O CSV público em `dados-publicos/` está incompleto.

**OBRIGATÓRIO antes da virada / do reset** (SQL pronto para revisão em `docs/sql/reset-corpus-lancamento.sql`; **backup completo FEITO em 1/out/2026**: `Desktop/backup-raiox-2026-10-01/supabase-completo.sql` — pg_dump do schema public, 9 tabelas, estrutura + dados + RLS, contagens conferidas (videos_snapshot 130.985, arquivo_bruto 57.011, canais_validados 6), sha256 b9691a3841d113a5…, fora do Git):
- Backup completo do Supabase (dump de schema + dados de todas as tabelas), confirmado íntegro com o Filipe.

**Preservar SEMPRE:**
- URLs de análises canônicas (para links já compartilhados continuarem funcionando)
- Estrutura das tabelas Supabase (não alterar schema)
- Prompts de sistema do Claude (estão validados)

---

## COMO ME COMUNICAR AO USUÁRIO

- Chame-o de "Filipe" ou "tu" (linguagem gaúcha)
- Direto ao ponto, sem enrolar
- Sem emojis desnecessários na comunicação
- Quando propor mudanças grandes, explicar trade-off honestamente
- Preservar decisões metodológicas — se algo parece "não fazer sentido" mas está no código, provavelmente é decisão consciente da pesquisa
- Perguntar antes de tomar decisão que afeta o corpus público ou dados históricos
