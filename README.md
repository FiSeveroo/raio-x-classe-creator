# 🔬 Raio-X Classe Creator

Ferramenta de auditoria algorítmica e pesquisa acadêmica do trabalho plataformizado no YouTube, desenvolvida pelo **Observatório Classe Creator**.

A ferramenta automatiza a análise sociológica de produtores, conteúdos e públicos da plataforma a partir de uma **tipologia dupla** mutuamente exclusiva, ancorada na pesquisa de mestrado *O Novo "You" do YouTube: a ascensão dos produtores plataformizados e a falência da promessa participativa no Brasil* (SEVERO, F. M. L. PUCRS/FAMECOS, 2026).

## Propósito

Romper com a visão alienante da "economia dos criadores" e elevar a consciência sobre o que significa trabalhar sob a governança algorítmica de plataformas capitalistas. Devolver materialidade ao trabalho que o YouTube reifica em categorias comerciais opacas.

> "Criar é trabalho."

## Os 5 módulos

1. **🔍 A Lupa** — análise micro de 1 vídeo
2. **🌡️ Termômetro do Em Alta** — análise macro longitudinal do trending BR (coleta automatizada semanal via GitHub Actions)
3. **⚔️ Disputa de Narrativa** — auditoria de autoridade algorítmica em temas
4. **📋 Dossiê do Canal** — investigação estrutural de produtores (modelo híbrido Haiku + Sonnet)
5. **💬 A Voz da Base** — análise qualitativa de comentários nas 6 dimensões sociológicas

## Tipologia (Severo, 2026)

**Eixo A — Produtor:** Mídia tradicional · Produtora digital · YouTuber profissional · Criador casual · Usuário comum · Instituições públicas e sociais · Músicos e bandas · Marcas comerciais · Reaproveitamento e pirataria · Outros usos.

**Eixo B — Conteúdo:** Informativo · Entretenimento roteirizado · Jogos eletrônicos · Esportivo · Musical · Promocional · Vlog · Educativo · Experimental · Outros.

## Métricas originais desenvolvidas

- **Desvio editorial** (Módulo 4): compara composição da busca com linha de base do trending
- **Sintomas estruturais** (Módulo 2): frequência industrial, créditos de equipe, links repetidos, padronização
- **Confronto auto-narrativa × realidade estrutural** (Módulo 2)
- **Índice de Pressão Produtiva** (Módulo 5): % de comentários do "público-patrão"
- **Contradição estrutural** (Módulo 5): cruzamento entre o que canal entrega e o que público pede
- **Vozes ausentes** (Módulo 4): categorias estatisticamente apagadas em temas

## Stack

- **Python + Streamlit** — interface acadêmica responsiva
- **YouTube Data API v3** — extração de metadados estruturados
- **Anthropic Claude (Haiku 4.5 + Sonnet 4.6)** — classificação e análise sociológica
- **Supabase (PostgreSQL)** — corpus longitudinal versionado
- **GitHub Actions** — coletor automatizado semanal do Termômetro

## Como executar localmente

```bash
pip install -r requirements.txt
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# preencha as chaves no arquivo secrets.toml
streamlit run app.py
```

## Licença e citação

Código aberto para fins de pesquisa acadêmica. Ao utilizar resultados desta ferramenta em publicações, cite:

> SEVERO, Filipe Machado Leal. *O Novo "You" do YouTube: a ascensão dos produtores plataformizados e a falência da promessa participativa no Brasil.* Dissertação (Mestrado em Comunicação) — Pontifícia Universidade Católica do Rio Grande do Sul, Porto Alegre, 2026.
