# 🔬 Raio-X Classe Creator

Ferramenta de auditoria algorítmica e pesquisa acadêmica do trabalho plataformizado no YouTube, desenvolvida pelo **Observatório Classe Creator**.

Automatiza, em escala, a análise sociológica que pesquisadores precisariam fazer manualmente — cruzando extração de dados via APIs oficiais com classificação assistida por LLMs — a partir de uma **tipologia dupla** mutuamente exclusiva, ancorada na dissertação de mestrado:

> SEVERO, Filipe Machado Leal. *O Novo "You" do YouTube: a ascensão dos produtores plataformizados e a falência da promessa participativa no Brasil.* Dissertação (Mestrado em Comunicação Social) — PUCRS/FAMECOS, Porto Alegre, 2026.

**"Criar é trabalho."**

---

## Propósito

Romper com a visão alienante da "economia dos criadores" e devolver materialidade ao trabalho que o YouTube reifica em categorias comerciais opacas. A ferramenta não usa as categorias da plataforma — usa uma tipologia sociológica própria, construída a partir da literatura de Estudos de Plataforma e validada empiricamente em 21 semanas de coleta do trending BR (n = 1.049 entradas).

---

## Os 7 módulos

| # | Módulo | Escala | O que faz |
|---|---|---|---|
| 🏠 | **Home** | — | Apresentação institucional, manifesto, agenda de pesquisa, vitrine acadêmica |
| 🔍 | **A Lupa** | Micro · 1 vídeo | Classifica na tipologia dupla com justificativa sociológica |
| 🌡️ | **Termômetro do Em Alta** | Macro longitudinal | Coleta automatizada semanal do trending BR (GitHub Actions) |
| ⚔️ | **Disputa de Narrativa** | Transversal temática | Audita autoridade algorítmica em temas; calcula desvio editorial |
| 📋 | **Dossiê do Canal** | Meso · 1 produtor | Investigação estrutural; confronta auto-narrativa com realidade |
| 💬 | **A Voz da Base** | Comunitária | Análise qualitativa de comentários; IPP; contradição estrutural |
| 📚 | **Biblioteca de Pesquisa** | Corpus público | Navega todas as análises já realizadas, com versionamento |

---

## Tipologia dupla (Severo, 2026)

A espinha dorsal de toda a ferramenta. Mutuamente exclusiva e exaustiva.

**Eixo A — Produtor (quem controla a produção?):**
Mídia tradicional · Produtora digital · YouTuber profissional · Criador casual · Usuário comum · Instituições públicas e sociais · Músicos e bandas · Marcas comerciais · Reaproveitamento e pirataria · Outros usos

**Eixo B — Conteúdo (que gênero de trabalho?):**
Informativo · Entretenimento roteirizado · Jogos eletrônicos · Esportivo · Musical · Promocional · Vlog · Educativo · Experimental · Outros

---

## Métricas originais

Desenvolvidas especificamente para esta ferramenta, com diferentes graus de consolidação científica:

| Métrica | Módulo | Status |
|---|---|---|
| **Desvio editorial** (qui-quadrado de aderência vs. linha de base do Termômetro) | Disputa | 🟡 Implementado, requer corpus robusto (≥10 snapshots) |
| **Vozes ausentes temáticas** (probabilística, distingue extinção estrutural de silenciamento) | Disputa | 🟢 Validado empiricamente |
| **Confronto auto-narrativa × realidade estrutural** | Dossiê | 🟢 Validado |
| **Sintomas estruturais** (frequência, duração, títulos padronizados, links repetidos) | Dossiê | 🟡 Heurístico, notas metodológicas explícitas |
| **Índice de Pressão Produtiva (IPP)** (% público-patrão; calibrado por percentis do corpus) | Voz da Base | 🟡 Requer corpus (≥15 análises para percentis) |
| **Contradição estrutural** (canal entrega vs. público pede) | Voz da Base | 🟡 Exploratório |
| **6 dimensões qualitativas de comentários** | Voz da Base | 🔴 Tipologia exploratória em desenvolvimento, não validada por intercodificadores |

---

## Corpus público e versionamento

Toda análise realizada pela ferramenta é armazenada permanentemente no banco de dados (Supabase) com versionamento — cada objeto (vídeo, canal, tema, análise de comentários) pode ter múltiplas versões históricas, preservando a evolução ao longo do tempo.

A **Biblioteca de Pesquisa** (módulo 📚) permite navegar todo o corpus acumulado. Um snapshot semanal em CSV é gerado automaticamente toda segunda-feira via GitHub Actions e commitado neste repositório (pasta `dados-publicos/`), permitindo download direto sem onerar a infraestrutura.

---

## Stack

- **Python + Streamlit** — interface responsiva, hospedada no Streamlit Community Cloud
- **YouTube Data API v3** — extração de metadados estruturados
- **Anthropic Claude Haiku 4.5** — classificação tipológica (Eixo A × Eixo B)
- **Anthropic Claude Sonnet 4.6** — síntese sociológica narrativa (Dossiê e Voz da Base)
- **Supabase (PostgreSQL)** — corpus longitudinal versionado e biblioteca pública
- **GitHub Actions** — coleta semanal do Termômetro + exportação semanal do corpus
- **scipy** — testes estatísticos (qui-quadrado de aderência no Desvio Editorial)

---

## Como executar localmente

```bash
pip install -r requirements.txt
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Preencha as 4 chaves no secrets.toml:
# YOUTUBE_API_KEY, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
streamlit run app.py
```

### Secrets necessários (também para deploy no Streamlit Cloud)

| Secret | Como obter |
|---|---|
| `YOUTUBE_API_KEY` | Google Cloud Console → APIs & Services → YouTube Data API v3 |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SUPABASE_URL` | Supabase → Project Settings → API (sem barra final) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API → anon key |

### SQL necessário (Supabase)

Execute os arquivos SQL nesta ordem para criar todas as tabelas:

1. `sql_modulo4.sql` — buscas e resultados (Disputa de Narrativa)
2. `sql_modulo2.sql` — dossiês de canal
3. `sql_modulo5.sql` — análises de comentários (Voz da Base)
4. `sql_telemetria.sql` — eventos de uso
5. `sql_migracao_versionamento.sql` — campos de versionamento (rodar por último)

---

## Status científico e transparência metodológica

Esta ferramenta é uma **proposta metodológica em desenvolvimento ativo**, não um sistema de classificação definitivo. Diferentes componentes têm diferentes graus de consolidação:

- A **tipologia dupla** (Severo, 2026) é o núcleo validado — construída a partir da literatura e testada empiricamente em 21 semanas de coleta manual.
- O **Termômetro** replica fielmente a metodologia da Tabela 02 da dissertação.
- As **heurísticas do Dossiê** (sintomas estruturais) são exploratórias, com notas metodológicas explícitas na interface.
- As **6 dimensões da Voz da Base** são tipologia original com ancoramento conceitual, pendente de validação intercodificador — declarado explicitamente na interface.

A validação formal das dimensões e a calibração empírica de métricas como o IPP são objetos de trabalho científico em curso, com publicação metodológica prevista.

---

## Citação

Ao utilizar resultados desta ferramenta em publicações, cite:

**Dissertação fundadora:**
> SEVERO, Filipe Machado Leal. *O Novo "You" do YouTube: a ascensão dos produtores plataformizados e a falência da promessa participativa no Brasil.* Dissertação (Mestrado em Comunicação Social) — Pontifícia Universidade Católica do Rio Grande do Sul, Porto Alegre, 2026.

**A ferramenta:**
> OBSERVATÓRIO CLASSE CREATOR. *Raio-X Classe Creator: ferramenta de auditoria algorítmica e pesquisa acadêmica do trabalho plataformizado no YouTube.* v1.0. Porto Alegre, 2026. Disponível em: https://raio-x-classe-creator.streamlit.app

---

## Contato e contribuição

Pesquisadores, jornalistas e organizações da sociedade civil interessados em colaborar — submetendo pesquisas para a vitrine, propondo refinamentos metodológicos, ou relatando erros de classificação — podem entrar em contato pelos canais do Observatório Classe Creator.

*"Criar é trabalho."*
