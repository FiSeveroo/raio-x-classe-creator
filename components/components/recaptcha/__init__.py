"""
Componente Streamlit customizado para Google reCAPTCHA v2 (checkbox).
Renderiza o widget em iframe e devolve o token para verificação server-side.
"""

import os
import streamlit.components.v1 as components

_COMPONENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

_component_func = components.declare_component(
    "streamlit_recaptcha",
    path=_COMPONENT_DIR,
)


def st_recaptcha(site_key: str, key: str | None = None) -> str | None:
    """
    Renderiza o widget reCAPTCHA v2 e retorna o token quando resolvido.

    Retorna:
        str — token do reCAPTCHA (válido por ~2 min)
        None — se o usuário ainda não resolveu
    """
    token = _component_func(site_key=site_key, key=key, default=None)
    return token if token else None
