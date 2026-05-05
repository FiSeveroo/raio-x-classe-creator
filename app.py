"""
==============================================================================
RAIO-X CLASSE CREATOR — MÓDULO 1: A LUPA
==============================================================================

A Lupa é o módulo de entrada para dissecação de artefatos individuais.
Recebe a URL de UM vídeo do YouTube, extrai metadados via API oficial,
submete ao Claude (com a tipologia da ferramenta como cérebro classificador)
e devolve:
  - classificação no Eixo A (Produtor)
  - classificação no Eixo B (Conteúdo)
  - justificativa sociológica curta

Esta é a v1: arquivo único, autocontido, pronto para deploy no Streamlit
Community Cloud. Os outros 4 módulos serão adicionados progressivamente.

Autor da metodologia: Filipe Machado Leal Severo (PUCRS / FAMECOS, 2026)
==============================================================================
"""

import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path

import anthropic
import requests
import streamlit as st

from tipologia import (
    PRODUTORES,
    CONTEUDOS,
    buscar_produtor,
    buscar_conteudo,
    codigos_produtor,
    codigos_conteudo,
    tipologia_para_prompt,
)


# ==============================================================================
# CONFIGURAÇÃO GLOBAL DA PÁGINA
# ==============================================================================

st.set_page_config(
    page_title="Raio-X Classe Creator",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded",
)

# CSS customizado: dark mode profundo + acentos neon (verde #39FF14 e roxo)
# Esta é a estética "manifesto urbano-digital" do Observatório Classe Creator.
st.markdown(
    """
    <style>
    /* Fundo principal: preto profundo */
    .stApp {
        background-color: #0a0a0a;
        color: #f5f5f5;
    }

    /* Sidebar: preto absoluto */
    [data-testid="stSidebar"] {
        background-color: #000000;
        border-right: 1px solid #1a1a1a;
    }

    /* Títulos principais em branco puro */
    h1, h2, h3 {
        color: #ffffff !important;
        font-weight: 700;
        letter-spacing: -0.02em;
    }

    /* Destaque NEON VERDE para dados sociológicos importantes */
    .neon-verde {
        color: #39FF14;
        font-weight: 700;
        text-shadow: 0 0 8px rgba(57, 255, 20, 0.4);
    }

    /* Destaque ROXO NEON para dados secundários */
    .neon-roxo {
        color: #b026ff;
        font-weight: 700;
        text-shadow: 0 0 8px rgba(176, 38, 255, 0.4);
    }

    /* Botões: preto com borda verde neon */
    .stButton > button {
        background-color: #000000;
        color: #39FF14;
        border: 1px solid #39FF14;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: all 0.2s ease;
    }
    .stButton > button:hover {
        background-color: #39FF14;
        color: #000000;
        box-shadow: 0 0 20px rgba(57, 255, 20, 0.5);
    }

    /* Caixas de input: fundo cinza escuro, borda discreta */
    .stTextInput > div > div > input {
        background-color: #1a1a1a;
        color: #f5f5f5;
        border: 1px solid #2a2a2a;
    }

    /* Cartões de classificação */
    .cartao-classificacao {
        background-color: #111111;
        border-left: 4px solid #39FF14;
        padding: 1.5rem;
        margin: 1rem 0;
        border-radius: 4px;
    }
    .cartao-classificacao.roxo {
        border-left-color: #b026ff;
    }

    /* Esconde o "Made with Streamlit" e header padrão para um look mais clínico */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}

    /* Texto da sidebar em branco */
    [data-testid="stSidebar"] * {
        color: #f5f5f5;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# ==============================================================================
# CHAVES DE API (secrets do Streamlit)
# ==============================================================================
# As chaves NUNCA ficam no código. Em produção (Streamlit Cloud), elas vivem
# em "App settings → Secrets". Em desenvolvimento local, em .streamlit/secrets.toml
# ==============================================================================

try:
    YOUTUBE_API_KEY = st.secrets["YOUTUBE_API_KEY"]
    ANTHROPIC_API_KEY = st.secrets["ANTHROPIC_API_KEY"]
except (FileNotFoundError, KeyError):
    st.error(
        "⚠️ Chaves de API não configuradas. "
        "Cadastre `YOUTUBE_API_KEY` e `ANTHROPIC_API_KEY` em "
        "**App settings → Secrets** no Streamlit Cloud."
    )
    st.stop()


# ==============================================================================
# BANCO DE DADOS LOCAL (SQLite) — cache de classificações
# ==============================================================================
# Cada vídeo classificado fica salvo. Se outro pesquisador analisar o mesmo
# vídeo nas próximas 24h, o resultado vem do cache: zero custo de API.
# ==============================================================================

DB_PATH = Path("raio_x.db")


def init_db() -> None:
    """Cria as tabelas se ainda não existirem."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS classificacoes_video (
            video_id TEXT PRIMARY KEY,
            titulo TEXT,
            canal_nome TEXT,
            canal_id TEXT,
            tipo_produtor TEXT,
            tipo_conteudo TEXT,
            justificativa TEXT,
            metadados_json TEXT,
            data_classificacao TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


def buscar_cache(video_id: str) -> dict | None:
    """Retorna a classificação salva, se existir."""
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT video_id, titulo, canal_nome, canal_id, tipo_produtor, "
        "tipo_conteudo, justificativa, metadados_json, data_classificacao "
        "FROM classificacoes_video WHERE video_id = ?",
        (video_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "video_id": row[0],
        "titulo": row[1],
        "canal_nome": row[2],
        "canal_id": row[3],
        "tipo_produtor": row[4],
        "tipo_conteudo": row[5],
        "justificativa": row[6],
        "metadados": json.loads(row[7]),
        "data": row[8],
        "do_cache": True,
    }


def salvar_cache(dados: dict) -> None:
    """Persiste a classificação para reuso futuro."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT OR REPLACE INTO classificacoes_video
        (video_id, titulo, canal_nome, canal_id, tipo_produtor,
         tipo_conteudo, justificativa, metadados_json, data_classificacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            dados["video_id"],
            dados["titulo"],
            dados["canal_nome"],
            dados["canal_id"],
            dados["tipo_produtor"],
            dados["tipo_conteudo"],
            dados["justificativa"],
            json.dumps(dados["metadados"], ensure_ascii=False),
            datetime.utcnow().isoformat(),
        ),
    )
    conn.commit()
    conn.close()


# ==============================================================================
# EXTRAÇÃO DE METADADOS — YouTube Data API v3
# ==============================================================================

def extrair_video_id(url: str) -> str | None:
    """
    Aceita qualquer formato de URL do YouTube e devolve o ID do vídeo.
    Suporta youtube.com/watch?v=, youtu.be/, shorts/, embed/.
    """
    padroes = [
        r"(?:v=|/)([0-9A-Za-z_-]{11}).*",
        r"youtu\.be/([0-9A-Za-z_-]{11})",
        r"shorts/([0-9A-Za-z_-]{11})",
        r"embed/([0-9A-Za-z_-]{11})",
    ]
    for padrao in padroes:
        match = re.search(padrao, url)
        if match:
            return match.group(1)
    # Se o usuário colou só o ID
    if re.fullmatch(r"[0-9A-Za-z_-]{11}", url.strip()):
        return url.strip()
    return None


def buscar_metadados_video(video_id: str) -> dict:
    """
    Consulta videos.list (custo: 1 unidade de cota).
    Retorna título, descrição, tags, categoria nativa, canal, estatísticas.
    """
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "id": video_id,
        "part": "snippet,statistics,contentDetails",
        "key": YOUTUBE_API_KEY,
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("items"):
        raise ValueError(
            "Vídeo não encontrado. Verifique se a URL está correta e se o vídeo é público."
        )
    item = data["items"][0]
    return {
        "video_id": video_id,
        "titulo": item["snippet"]["title"],
        "descricao": item["snippet"].get("description", ""),
        "tags": item["snippet"].get("tags", []),
        "categoria_nativa_id": item["snippet"].get("categoryId", ""),
        "canal_id": item["snippet"]["channelId"],
        "canal_nome": item["snippet"]["channelTitle"],
        "data_publicacao": item["snippet"]["publishedAt"],
        "duracao_iso": item["contentDetails"]["duration"],
        "visualizacoes": int(item["statistics"].get("viewCount", 0)),
        "likes": int(item["statistics"].get("likeCount", 0)),
        "comentarios": int(item["statistics"].get("commentCount", 0)),
    }


def buscar_metadados_canal(canal_id: str) -> dict:
    """
    Consulta channels.list (custo: 1 unidade de cota).
    Retorna descrição do canal, contagem de inscritos, total de vídeos.
    Esses dados ajudam o LLM a inferir o Tipo de Produtor.
    """
    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {
        "id": canal_id,
        "part": "snippet,statistics",
        "key": YOUTUBE_API_KEY,
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("items"):
        return {}
    item = data["items"][0]
    return {
        "canal_descricao": item["snippet"].get("description", ""),
        "inscritos": int(item["statistics"].get("subscriberCount", 0)),
        "total_videos": int(item["statistics"].get("videoCount", 0)),
        "total_views": int(item["statistics"].get("viewCount", 0)),
    }


# ==============================================================================
# CLASSIFICAÇÃO COM CLAUDE — o cérebro sociológico
# ==============================================================================

def classificar_com_claude(metadados_video: dict, metadados_canal: dict) -> dict:
    """
    Submete os metadados ao Claude Haiku 4.5, que classifica o vídeo
    nos dois eixos da tipologia e gera uma justificativa sociológica.

    Retorna: {tipo_produtor, tipo_conteudo, justificativa}
    """
    cliente = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    prompt_sistema = f"""Você é um pesquisador especialista em Estudos de Plataforma, \
trabalhando para o Observatório Classe Creator. Sua tarefa é classificar artefatos \
do YouTube usando uma TIPOLOGIA DUPLA específica, ancorada na pesquisa acadêmica \
de Filipe Severo (PUCRS/FAMECOS, 2026).

Esta tipologia NÃO usa as categorias comerciais do YouTube. Ela busca devolver \
a materialidade do trabalho ao artefato audiovisual e revelar a estrutura social \
de produção por trás do conteúdo.

==========
{tipologia_para_prompt()}
==========

REGRAS DE CLASSIFICAÇÃO:
1. Você DEVE escolher exatamente UMA categoria do Eixo A e UMA do Eixo B.
2. As categorias são MUTUAMENTE EXCLUSIVAS — escolha a mais adequada.
3. Use "outros" SOMENTE se nenhuma outra categoria fizer sentido.
4. A justificativa deve ser SOCIOLÓGICA, não descritiva: explique o que a \
classificação revela sobre as relações de produção, não o que o vídeo "é sobre".
5. Considere SEMPRE o canal como pista primária do Eixo A (quem produz?), \
e o conteúdo do vídeo como pista primária do Eixo B (que gênero de trabalho?).
6. Atenção a "vlogs falsos" e estéticas de autenticidade roteirizada \
(Cunningham & Craig, 2017): não confunda performance de espontaneidade com \
amadorismo real.

FORMATO DA RESPOSTA: retorne APENAS um JSON válido, sem markdown, sem comentários:
{{
  "tipo_produtor": "<código exato do Eixo A>",
  "tipo_conteudo": "<código exato do Eixo B>",
  "justificativa": "<2 a 4 frases analíticas>"
}}

CÓDIGOS VÁLIDOS Eixo A: {", ".join(codigos_produtor())}
CÓDIGOS VÁLIDOS Eixo B: {", ".join(codigos_conteudo())}
"""

    payload_video = f"""DADOS DO VÍDEO:
- Título: {metadados_video['titulo']}
- Canal: {metadados_video['canal_nome']}
- Inscritos do canal: {metadados_canal.get('inscritos', 'desconhecido'):,}
- Total de vídeos do canal: {metadados_canal.get('total_videos', 'desconhecido'):,}
- Visualizações deste vídeo: {metadados_video['visualizacoes']:,}
- Tags: {', '.join(metadados_video['tags'][:20]) if metadados_video['tags'] else '(sem tags)'}

DESCRIÇÃO DO CANAL:
{metadados_canal.get('canal_descricao', '(sem descrição)')[:1500]}

DESCRIÇÃO DO VÍDEO:
{metadados_video['descricao'][:2000]}
"""

    resposta = cliente.messages.create(
        model="claude-haiku-4-5",
        max_tokens=600,
        system=prompt_sistema,
        messages=[{"role": "user", "content": payload_video}],
    )

    texto = resposta.content[0].text.strip()
    # Limpa eventuais cercas de código que o modelo possa ter adicionado
    texto = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto, flags=re.MULTILINE).strip()

    try:
        resultado = json.loads(texto)
    except json.JSONDecodeError as e:
        raise ValueError(f"Resposta do Claude não é JSON válido: {texto}") from e

    # Valida que os códigos são reconhecidos pela tipologia
    if resultado["tipo_produtor"] not in codigos_produtor():
        raise ValueError(f"Código de produtor inválido: {resultado['tipo_produtor']}")
    if resultado["tipo_conteudo"] not in codigos_conteudo():
        raise ValueError(f"Código de conteúdo inválido: {resultado['tipo_conteudo']}")

    return resultado


# ==============================================================================
# INTERFACE — SIDEBAR DE NAVEGAÇÃO
# ==============================================================================

with st.sidebar:
    st.markdown("# 🔬 RAIO-X")
    st.markdown("### Classe Creator")
    st.markdown("---")
    st.markdown("**Observatório Classe Creator**")
    st.markdown(
        '<small>Ferramenta de auditoria algorítmica e pesquisa acadêmica '
        'do trabalho plataformizado.</small>',
        unsafe_allow_html=True,
    )
    st.markdown("---")
    st.markdown("**MÓDULOS**")
    st.markdown("🔍 **A Lupa** — análise de 1 vídeo")
    st.markdown("📋 *Dossiê do Canal* (em breve)")
    st.markdown("🌡️ *Termômetro do Em Alta* (em breve)")
    st.markdown("⚔️ *Disputa de Narrativa* (em breve)")
    st.markdown("💬 *Voz da Base* (em breve)")
    st.markdown("---")
    st.markdown(
        '<small><i>"Criar é trabalho."</i></small>',
        unsafe_allow_html=True,
    )


# ==============================================================================
# INTERFACE — CORPO PRINCIPAL DO MÓDULO 1
# ==============================================================================

st.markdown("# 🔍 A Lupa")
st.markdown(
    "##### Dissecação sociológica de um artefato audiovisual"
)
st.markdown(
    "Cole abaixo o link de um vídeo do YouTube. A ferramenta extrairá os "
    "metadados via API oficial e classificará o artefato segundo a "
    "**tipologia dupla** (Produtor × Conteúdo) desenvolvida na pesquisa "
    "*O Novo 'You' do YouTube* (SEVERO, 2026)."
)

init_db()

url_input = st.text_input(
    "URL do vídeo",
    placeholder="https://www.youtube.com/watch?v=...",
    label_visibility="collapsed",
)

col_a, col_b = st.columns([1, 5])
with col_a:
    botao = st.button("ANALISAR", use_container_width=True)

# ==============================================================================
# EXECUÇÃO DA ANÁLISE
# ==============================================================================

if botao and url_input:
    video_id = extrair_video_id(url_input)
    if not video_id:
        st.error("URL inválida. Cole uma URL completa do YouTube ou apenas o ID do vídeo (11 caracteres).")
        st.stop()

    cache = buscar_cache(video_id)
    if cache:
        st.info(f"⚡ Resultado recuperado do cache (analisado em {cache['data'][:10]}). Zero custo de API.")
        meta = cache["metadados"]
        meta["canal_nome"] = cache["canal_nome"]
        meta["titulo"] = cache["titulo"]
        resultado = {
            "tipo_produtor": cache["tipo_produtor"],
            "tipo_conteudo": cache["tipo_conteudo"],
            "justificativa": cache["justificativa"],
        }
    else:
        try:
            with st.spinner("Extraindo metadados do vídeo..."):
                meta_video = buscar_metadados_video(video_id)
            with st.spinner("Investigando o canal produtor..."):
                meta_canal = buscar_metadados_canal(meta_video["canal_id"])
            with st.spinner("Submetendo à análise sociológica..."):
                resultado = classificar_com_claude(meta_video, meta_canal)

            # Persiste no cache para reusos futuros
            salvar_cache(
                {
                    "video_id": video_id,
                    "titulo": meta_video["titulo"],
                    "canal_nome": meta_video["canal_nome"],
                    "canal_id": meta_video["canal_id"],
                    "tipo_produtor": resultado["tipo_produtor"],
                    "tipo_conteudo": resultado["tipo_conteudo"],
                    "justificativa": resultado["justificativa"],
                    "metadados": {**meta_video, **meta_canal},
                }
            )
            meta = {**meta_video, **meta_canal}
        except ValueError as e:
            st.error(f"Erro na análise: {e}")
            st.stop()
        except requests.HTTPError as e:
            st.error(
                f"Erro ao consultar a API do YouTube: {e}. "
                "Pode ser cota esgotada ou chave inválida."
            )
            st.stop()

    # ==========================================================================
    # APRESENTAÇÃO DOS RESULTADOS
    # ==========================================================================

    st.markdown("---")
    st.markdown(f"### 🎬 {meta['titulo']}")
    st.markdown(f"*Canal:* **{meta['canal_nome']}**")

    col1, col2, col3 = st.columns(3)
    col1.metric("Visualizações", f"{meta.get('visualizacoes', 0):,}".replace(",", "."))
    col2.metric("Inscritos do canal", f"{meta.get('inscritos', 0):,}".replace(",", "."))
    col3.metric("Total de vídeos do canal", f"{meta.get('total_videos', 0):,}".replace(",", "."))

    st.markdown("---")
    st.markdown("## DIAGNÓSTICO TIPOLÓGICO")

    produtor = buscar_produtor(resultado["tipo_produtor"])
    conteudo = buscar_conteudo(resultado["tipo_conteudo"])

    col_eixo_a, col_eixo_b = st.columns(2)

    with col_eixo_a:
        st.markdown(
            f"""
            <div class="cartao-classificacao">
                <small style="color:#888; letter-spacing:0.1em;">EIXO A · PRODUTOR</small>
                <h2 class="neon-verde" style="margin: 0.5rem 0;">{produtor.nome}</h2>
                <p style="color:#ccc; margin:0;"><small>{produtor.definicao}</small></p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_eixo_b:
        st.markdown(
            f"""
            <div class="cartao-classificacao roxo">
                <small style="color:#888; letter-spacing:0.1em;">EIXO B · CONTEÚDO</small>
                <h2 class="neon-roxo" style="margin: 0.5rem 0;">{conteudo.nome}</h2>
                <p style="color:#ccc; margin:0;"><small>{conteudo.definicao}</small></p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("### Justificativa sociológica")
    st.markdown(
        f"""
        <div style="background:#111; padding:1.5rem; border-radius:4px;
                    border-left: 4px solid #ffffff;">
            {resultado['justificativa']}
        </div>
        """,
        unsafe_allow_html=True,
    )

    with st.expander("🔧 Metadados brutos (para auditoria)"):
        st.json(meta)
