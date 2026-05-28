"""
==============================================================================
RAIO-X CLASSE CREATOR — COLETOR AUTOMATIZADO DO TERMÔMETRO
==============================================================================

Este script é executado pelo GitHub Actions semanalmente (alternando dias e
horários, conforme Tabela 02 da dissertação Severo, 2026).

Ele:
  1. Calcula em qual slot semanal estamos (qual dia/horário "tocar")
  2. Coleta os 50 vídeos do trending do Brasil via YouTube Data API
  3. Classifica cada um com Claude Haiku 4.5 (Eixo A + Eixo B + justificativa)
  4. Persiste tudo no Supabase como um snapshot

Custo por execução:
  - YouTube API: ~3 unidades de cota
  - Claude Haiku: ~50 vídeos × US$ 0,003 = US$ 0,15 ≈ R$ 0,75

NÃO IMPORTA este arquivo do app Streamlit. Ele é independente.
==============================================================================
"""

import json
import os
import re
import sys
import time
from datetime import datetime

import anthropic
import requests

from db import conectar, criar_snapshot, gravar_video_classificado, calcular_proxima_coleta_semanal, ultima_semana_coletada
from tipologia import codigos_produtor, codigos_conteudo, tipologia_para_prompt


# ==============================================================================
# CONFIGURAÇÃO
# ==============================================================================

YOUTUBE_API_KEY = os.environ["YOUTUBE_API_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
MODELO_CLASSIFICADOR = "claude-haiku-4-5"
REGIAO = "BR"
QUANTIDADE_VIDEOS = 100

cliente_anthropic = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ==============================================================================
# COLETA — YouTube Data API
# ==============================================================================

def coletar_trending_por_fonte(categoria_id: str | None = None, quantidade: int = 100) -> list[dict]:
    """
    Consulta videos.list?chart=mostPopular&regionCode=BR
    categoria_id: None = geral, "17" = Sports, "25" = News & Politics
    Custo: 2 chamadas de cota (maxResults=50 por chamada, paginado)
    """
    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "snippet,statistics,contentDetails",
        "chart": "mostPopular",
        "regionCode": REGIAO,
        "maxResults": 50,
        "key": YOUTUBE_API_KEY,
    }
    if categoria_id:
        params["videoCategoryId"] = categoria_id

    items = []
    page_token = None

    while len(items) < quantidade:
        if page_token:
            params["pageToken"] = page_token
        elif "pageToken" in params:
            del params["pageToken"]

        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items.extend(data.get("items", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    return items[:quantidade]


def coletar_trending(quantidade: int = 100) -> list[dict]:
    """
    Coleta trending BR de 3 fontes: geral + Sports (cat.17) + News (cat.25).
    Deduplica por video_id e retorna top N por visualizações.
    Custo: ~6 unidades de cota (2 chamadas por fonte × 3 fontes).
    """
    vistos = set()
    todos = []

    # Todas as categorias válidas para BR que funcionam como filtro
    # Excluídas: cat.19 (404), cat.27 (404) — não funcionam como filtro de mostPopular
    fontes = [
        (None,  "geral"),
        ("1",   "Filmes e desenhos"),
        ("2",   "Automóveis"),
        ("10",  "Música"),
        ("15",  "Animais"),
        ("17",  "Esportes"),
        ("20",  "Jogos"),
        ("22",  "Pessoas e blogs"),
        ("23",  "Comédia"),
        ("24",  "Entretenimento"),
        ("25",  "Notícias e política"),
        ("26",  "Tutoriais e estilo"),
        ("28",  "Ciência e tecnologia"),
    ]

    for cat_id, label in fontes:
        try:
            items = coletar_trending_por_fonte(cat_id, quantidade=100)
            novos = 0
            for item in items:
                vid_id = item["id"]
                if vid_id not in vistos:
                    vistos.add(vid_id)
                    todos.append(item)
                    novos += 1
            print(f"   → {label}: {len(items)} coletados, {novos} únicos adicionados")
        except Exception as e:
            print(f"   ⚠️ Erro ao coletar {label}: {e}")

    # Ordena por visualizações e retorna top N
    todos.sort(
        key=lambda x: int(x.get("statistics", {}).get("viewCount", 0)),
        reverse=True
    )
    print(f"   → Total deduplicado: {len(todos)} vídeos | Retornando top {quantidade}")
    return todos[:quantidade]


def coletar_metadados_canais(canais_ids: list[str]) -> dict[str, dict]:
    """
    Busca metadados dos canais únicos do trending de uma vez.
    Custo: 1 unidade — a API aceita até 50 IDs por chamada.
    Retorna dict {canal_id: metadados}.
    """
    if not canais_ids:
        return {}

    url = "https://www.googleapis.com/youtube/v3/channels"
    params = {
        "part": "snippet,statistics",
        "id": ",".join(canais_ids[:50]),
        "key": YOUTUBE_API_KEY,
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()

    canais = {}
    for item in resp.json().get("items", []):
        canais[item["id"]] = {
            "canal_descricao": item["snippet"].get("description", ""),
            "inscritos": int(item["statistics"].get("subscriberCount", 0)),
            "total_videos": int(item["statistics"].get("videoCount", 0)),
            "total_views": int(item["statistics"].get("viewCount", 0)),
        }
    return canais


def duracao_iso_para_segundos(duracao_iso: str) -> int:
    """
    Converte ISO 8601 (PT1H30M45S) para segundos.
    Útil para cruzar com a tese da dissertação sobre duração média.
    """
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duracao_iso or "")
    if not match:
        return 0
    h, m, s = (int(g) if g else 0 for g in match.groups())
    return h * 3600 + m * 60 + s


def normalizar_metadados_video(item: dict, dados_canal: dict) -> dict:
    """Padroniza o formato dos metadados para uso interno."""
    return {
        "video_id": item["id"],
        "titulo": item["snippet"]["title"],
        "descricao": item["snippet"].get("description", ""),
        "tags": item["snippet"].get("tags", []),
        "canal_id": item["snippet"]["channelId"],
        "canal_nome": item["snippet"]["channelTitle"],
        "data_publicacao": item["snippet"]["publishedAt"],
        "duracao_segundos": duracao_iso_para_segundos(item["contentDetails"]["duration"]),
        "visualizacoes": int(item["statistics"].get("viewCount", 0)),
        "likes": int(item["statistics"].get("likeCount", 0)),
        "comentarios": int(item["statistics"].get("commentCount", 0)),
        # Dados do canal para o classificador
        "canal_descricao": dados_canal.get("canal_descricao", ""),
        "inscritos_canal": dados_canal.get("inscritos", 0),
        "total_videos_canal": dados_canal.get("total_videos", 0),
    }


# ==============================================================================
# CLASSIFICAÇÃO — Claude Haiku
# ==============================================================================

def classificar_video(metadados: dict) -> dict:
    """
    Submete um vídeo ao Claude para classificação na tipologia dupla.
    Reusa o mesmo prompt sociológico do Módulo 1 (consistência metodológica).
    """
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
4. A justificativa deve ser SOCIOLÓGICA, não descritiva.
5. Considere SEMPRE o canal como pista primária do Eixo A (quem produz?), e o conteúdo do vídeo como pista primária do Eixo B (que gênero de trabalho?).
6. Atenção a "vlogs falsos": não confunda performance de espontaneidade com amadorismo real.

TESTE DECISIVO — Produtora vs. YouTuber:
"Se essa pessoa saísse do canal, o canal continuaria existindo como marca?"
- SIM → produtora_digital (ex: Ei Nerd, Flow, CazéTV, Canal GOAT, Manual do Mundo)
- NÃO → youtuber_profissional (ex: Whindersson, Felipe Neto, Casimiro, Gaules, Virgínia)

TESTE DECISIVO — Marca vs. Produtora vs. Instituição:
"O conteúdo existe para divulgar algo que existe fora do YouTube?"
- SIM → marca (clubes, empresas, jogos)
- NÃO, o evento existe para gerar audiência → produtora_digital
- A entidade regula atividade reconhecida → instituicao

EXEMPLOS VALIDADOS PELO PESQUISADOR (calibração obrigatória):
Produtora Digital: Ei Nerd, Gaules, CazéTV, Canal GOAT, MrBeast, Enaldinho, Flow Games, Cortes do Inteligência [OFICIAL], Kings League
YouTuber Profissional: Mendrake, Tonigon, rezendeevil, Jazzghost, Natan por Aí
Marca: Flamengo TV, UFC Brasil, VALORANT Esports BR, EA SPORTS FC MOBILE
Instituição: CONMEBOL, Federação Catarinense de Futebol
Reaproveitamento: canais de "melhores hinos evangélicos", "top sertanejo", compilações de lances de futebol sem produção própria

ATENÇÃO CRÍTICA — EIXO B:
O campo tipo_conteudo DEVE ser um gênero de conteúdo (Eixo B).
NUNCA use códigos do Eixo A (como "reaproveitamento", "marca", "musico") no tipo_conteudo.
Exemplos corretos de Eixo B: musical, esportivo, informativo, vlog, jogos, entretenimento_roteirizado

CÓDIGOS VÁLIDOS Eixo A: {", ".join(codigos_produtor())}
CÓDIGOS VÁLIDOS Eixo B: {", ".join(codigos_conteudo())}
"""

    payload = f"""DADOS DO VÍDEO:
- Título: {metadados['titulo']}
- Canal: {metadados['canal_nome']}
- Inscritos do canal: {metadados['inscritos_canal']:,}
- Total de vídeos do canal: {metadados['total_videos_canal']:,}
- Visualizações: {metadados['visualizacoes']:,}
- Duração: {metadados['duracao_segundos']} segundos
- Tags: {', '.join(metadados['tags'][:20]) if metadados['tags'] else '(sem tags)'}

DESCRIÇÃO DO CANAL:
{metadados['canal_descricao'][:1500]}

DESCRIÇÃO DO VÍDEO:
{metadados['descricao'][:2000]}
"""

    resposta = cliente_anthropic.messages.create(
        model=MODELO_CLASSIFICADOR,
        max_tokens=600,
        system=prompt_sistema,
        messages=[{"role": "user", "content": payload}],
    )

    texto = resposta.content[0].text.strip()
    texto = re.sub(r"^```(?:json)?\s*|\s*```$", "", texto, flags=re.MULTILINE).strip()
    resultado = json.loads(texto)

    # Validações defensivas
    if resultado["tipo_produtor"] not in codigos_produtor():
        raise ValueError(f"Código de produtor inválido: {resultado['tipo_produtor']}")
    if resultado["tipo_conteudo"] not in codigos_conteudo():
        raise ValueError(f"Código de conteúdo inválido: {resultado['tipo_conteudo']}")

    return resultado


# ==============================================================================
# ORQUESTRAÇÃO PRINCIPAL
# ==============================================================================

def executar_coleta() -> None:
    """Executa o pipeline completo de uma coleta semanal."""
    inicio = datetime.now()
    print(f"\n{'='*70}")
    print(f"INICIANDO COLETA — {inicio.isoformat()}")
    print(f"{'='*70}\n")

    # 1. Determinar slot da semana (replica metodologia da dissertação)
    semana, dia, horario = calcular_proxima_coleta_semanal()
    print(f"📅 Semana ISO {semana} | Slot programado: {dia} às {horario}")
    print(f"   Hora real do sistema (UTC): {inicio.strftime('%A %H:%M')}")

    FORCA_EXECUCAO = os.getenv("FORCA_EXECUCAO", "").lower() == "true"

    # Guard clause: verifica se já coletamos nesta semana ISO
    # Permite qualquer disparo do cron dentro da semana correta — não exige dia/hora exatos
    # (GitHub Actions pode atrasar, e queremos garantir pelo menos 1 coleta por semana)
    if not FORCA_EXECUCAO:
        try:
            cliente_guard = conectar()
            ultima_semana = ultima_semana_coletada(cliente_guard)
            if ultima_semana == semana:
                print(f"⏭️  COLETA IGNORADA — semana ISO {semana} já foi coletada.")
                print(f"   Para forçar nova coleta, defina FORCA_EXECUCAO=true.")
                sys.exit(0)
        except Exception as e:
            print(f"⚠️  Não foi possível verificar última semana coletada: {e}")
            print(f"   Prosseguindo com a coleta por precaução.")

    print(f"✅ Semana ISO {semana} ainda não coletada — executando coleta.")

    # 2. Coletar trending
    print("\n📥 Coletando 50 vídeos do trending BR...")
    items_trending = coletar_trending(QUANTIDADE_VIDEOS)
    if not items_trending:
        print("⚠️ Trending vazio — abortando.")
        sys.exit(1)
    print(f"   → {len(items_trending)} vídeos coletados")

    # 3. Coletar metadados dos canais únicos
    canais_unicos = list({item["snippet"]["channelId"] for item in items_trending})
    print(f"\n📥 Coletando metadados de {len(canais_unicos)} canais únicos...")
    metadados_canais = coletar_metadados_canais(canais_unicos)

    # 4. Conectar ao Supabase em modo escrita
    print("\n💾 Conectando ao Supabase (modo escrita)...")
    db = conectar(modo="escrita")

    # 5. Criar registro do snapshot
    snapshot_id = criar_snapshot(
        db,
        semana_ano=semana,
        dia_semana=dia,
        horario_coleta=horario,
        total_videos=len(items_trending),
        observacoes=f"Coleta automatizada GitHub Actions. Hora real: {inicio.isoformat()}",
    )
    print(f"   → Snapshot ID #{snapshot_id} criado")

    # 6. Classificar e persistir cada vídeo
    print(f"\n🔬 Classificando {len(items_trending)} vídeos com {MODELO_CLASSIFICADOR}...\n")
    sucessos = 0
    falhas = 0
    for posicao, item in enumerate(items_trending, start=1):
        canal_id = item["snippet"]["channelId"]
        dados_canal = metadados_canais.get(canal_id, {})
        meta = normalizar_metadados_video(item, dados_canal)

        try:
            classificacao = classificar_video(meta)
            gravar_video_classificado(
                db, snapshot_id, posicao, meta, classificacao, MODELO_CLASSIFICADOR
            )
            sucessos += 1
            print(
                f"  [{posicao:02d}] {meta['canal_nome'][:40]:<40} "
                f"→ {classificacao['tipo_produtor']:<25} | {classificacao['tipo_conteudo']}"
            )
        except Exception as e:
            falhas += 1
            print(f"  [{posicao:02d}] ❌ ERRO em '{meta['titulo'][:50]}': {e}")
            # Não interrompe a coleta inteira por causa de 1 vídeo problemático

        # Pequena pausa para evitar rate limit da Anthropic
        time.sleep(0.5)

    # 7. Relatório final
    fim = datetime.now()
    duracao = (fim - inicio).total_seconds()
    print(f"\n{'='*70}")
    print(f"COLETA FINALIZADA — duração: {duracao:.1f}s")
    print(f"  ✅ Sucessos: {sucessos}")
    print(f"  ❌ Falhas:   {falhas}")
    print(f"  📊 Snapshot ID: #{snapshot_id}")
    print(f"{'='*70}\n")

    if falhas > sucessos:
        print("⚠️ Mais falhas que sucessos. Investigue antes da próxima coleta.")
        sys.exit(1)


if __name__ == "__main__":
    executar_coleta()
