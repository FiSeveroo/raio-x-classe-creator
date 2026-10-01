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
- **Fase 1 — código pronto em 29/set/2026**; falta testar a leitura do Supabase com credenciais reais (`.env.local`). Next.js 16 + next-intl (PT sem prefixo, /en, /es), tema, Home, Sobre, Biblioteca (4 abas, só leitura) e página por análise de vídeo (`/biblioteca/video/[id]`, com imagem Open Graph). Módulos da Fase 2 têm página provisória que aponta para o Streamlit.
- **Repaginada da UX (30/set–1/out/2026):** a barra lateral virou cabeçalho com painel "Módulos" + rodapé completo; Home reorganizada como narrativa (hero com CTA laranja, faixa do corpus, bloco roxo com as duas perguntas, módulos em linhas numeradas). Aguardando feedback do Filipe e o logo.
- Convenções: textos só em `messages/*.json` (markdown-lite `**negrito**` renderizado por `src/components/rico.tsx`); consultas ao banco só em `src/lib/corpus.ts`; traduções novas entram em `messages/REVISAO.md`.

**OBRIGATÓRIO antes de aplicar a migração (virada de domínio / Next.js passar a gravar no Supabase de produção):**
- Fazer backup completo do Supabase (dump de schema + dados de todas as tabelas) e confirmar com o Filipe que o backup está íntegro. Decidido em 29/set/2026: não fazer agora, fazer imediatamente antes da virada.
- Até lá, o app Next.js só LÊ do Supabase de produção.

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
