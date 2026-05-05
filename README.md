# 🔬 Raio-X Classe Creator

Ferramenta de auditoria algorítmica e pesquisa acadêmica do trabalho plataformizado no YouTube, desenvolvida pelo **Observatório Classe Creator**.

A ferramenta automatiza a análise sociológica de produtores e conteúdos da plataforma a partir de uma **tipologia dupla** mutuamente exclusiva, ancorada na pesquisa de mestrado *O Novo "You" do YouTube: a ascensão dos produtores plataformizados e a falência da promessa participativa no Brasil* (SEVERO, F. M. L. PUCRS/FAMECOS, 2026).

## Propósito

Romper com a visão alienante da "economia dos criadores" e elevar a consciência sobre o que significa trabalhar sob a governança algorítmica de plataformas capitalistas. Devolver materialidade ao trabalho que o YouTube reifica em categorias comerciais opacas.

> "Criar é trabalho."

## Os 5 módulos

1. **🔍 A Lupa** — análise micro de 1 vídeo *(disponível)*
2. **📋 Dossiê do Canal** — análise meso de produtores e suas redes
3. **🌡️ Termômetro do Em Alta** — análise macro do trending diário
4. **⚔️ Disputa de Narrativa** — auditoria de autoridade algorítmica em temas
5. **💬 Voz da Base** — análise comunitária de comentários e relações de classe

## Tipologia (Severo, 2026)

**Eixo A — Produtor:** Mídia tradicional · Produtora digital · YouTuber profissional · Criador casual · Usuário comum · Instituições públicas e sociais · Músicos e bandas · Marcas comerciais · Reaproveitamento e pirataria · Outros usos.

**Eixo B — Conteúdo:** Informativo · Entretenimento roteirizado · Jogos eletrônicos · Esportivo · Musical · Promocional · Vlog · Educativo · Experimental · Outros.

## Stack

- **Python + Streamlit** — interface acadêmica responsiva
- **YouTube Data API v3** — extração de metadados estruturados
- **Anthropic Claude (Haiku 4.5)** — classificação tipológica assistida
- **SQLite** — cache local de classificações

## Como executar localmente

```bash
pip install -r requirements.txt
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# preencha as chaves no arquivo secrets.toml
streamlit run app.py
```

## Licença e citação

Código aberto para fins de pesquisa acadêmica. Ao utilizar resultados desta ferramenta em publicações, cite:

> SEVERO, Filipe. *O Novo "You" do YouTube: a ascensão dos produtores plataformizados e a falência da promessa participativa no Brasil.* Dissertação (Mestrado em Comunicação) — Pontifícia Universidade Católica do Rio Grande do Sul, Porto Alegre, 2026.
