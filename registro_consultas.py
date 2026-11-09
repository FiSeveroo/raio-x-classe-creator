"""
Registro bruto das consultas ao mostPopular, sem remoção de repetidos.

Guarda o que cada consulta devolveu (geral e cada categoria), inclusive erros,
nas tabelas consultas_coleta e consultas_coleta_videos. Serve para medir a
sobreposição entre o geral e os filtros, que o videos_snapshot não permite.

Nada aqui pode derrubar o Termômetro: toda função captura as próprias exceções.
"""

import uuid
from datetime import datetime, timezone

from db import conectar

# Dão erro como filtro hoje; consultadas só para registrar o resultado.
FONTES_SO_REGISTRO = [("19", "Viagens"), ("27", "Educação")]
TAMANHO_LOTE = 500


def novo_registro() -> dict:
    return {
        "coleta_uuid": str(uuid.uuid4()),
        "coletado_em": datetime.now(timezone.utc).isoformat(),
        "consultas": [],
    }


def anotar_sucesso(registro: dict, endpoint: str, items: list[dict]) -> None:
    try:
        videos = [
            {
                "posicao": posicao,
                "video_id": item["id"],
                "category_id": item.get("snippet", {}).get("categoryId"),
                "canal_id": item.get("snippet", {}).get("channelId"),
                "visualizacoes": _inteiro(item.get("statistics", {}).get("viewCount")),
            }
            for posicao, item in enumerate(items, start=1)
        ]
        registro["consultas"].append({
            "endpoint": endpoint, "http_status": 200, "erro_motivo": None, "videos": videos,
        })
    except Exception as e:
        print(f"   ⚠️ Registro bruto: não anotou {endpoint}: {type(e).__name__}")


def anotar_erro(registro: dict, endpoint: str, erro: Exception) -> None:
    # Só código e motivo: a mensagem da exceção traz a URL com a chave da API.
    try:
        status, motivo = None, type(erro).__name__
        resposta = getattr(erro, "response", None)
        if resposta is not None:
            status = resposta.status_code
            try:
                motivo = resposta.json()["error"]["errors"][0]["reason"]
            except Exception:
                motivo = "sem_motivo_na_resposta"
        registro["consultas"].append({
            "endpoint": endpoint, "http_status": status, "erro_motivo": motivo, "videos": [],
        })
    except Exception as e:
        print(f"   ⚠️ Registro bruto: não anotou erro de {endpoint}: {type(e).__name__}")


def gravar_registro(registro: dict) -> None:
    try:
        db = conectar(modo="escrita")
        resposta = db.table("consultas_coleta").insert([
            {
                "coleta_uuid": registro["coleta_uuid"],
                "coletado_em": registro["coletado_em"],
                "endpoint": c["endpoint"],
                "http_status": c["http_status"],
                "erro_motivo": c["erro_motivo"],
                "itens_devolvidos": len(c["videos"]),
            }
            for c in registro["consultas"]
        ]).execute()
        ids = {linha["endpoint"]: linha["id"] for linha in resposta.data}

        linhas = [
            {"consulta_id": ids[c["endpoint"]], **video}
            for c in registro["consultas"]
            for video in c["videos"]
        ]
        for i in range(0, len(linhas), TAMANHO_LOTE):
            db.table("consultas_coleta_videos").insert(linhas[i:i + TAMANHO_LOTE]).execute()
        print(f"   → Registro bruto: {len(ids)} consultas, {len(linhas)} vídeos")
    except Exception as e:
        print(f"   ⚠️ Registro bruto não gravado ({type(e).__name__}); a coleta segue normal.")


def vincular_snapshot(registro: dict, snapshot_id: int) -> None:
    try:
        db = conectar(modo="escrita")
        db.table("consultas_coleta").update({"snapshot_id": snapshot_id}).eq(
            "coleta_uuid", registro["coleta_uuid"]
        ).execute()
    except Exception as e:
        print(f"   ⚠️ Registro bruto: snapshot não vinculado ({type(e).__name__}).")


def _inteiro(valor):
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None
