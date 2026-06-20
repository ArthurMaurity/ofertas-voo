# -*- coding: utf-8 -*-
"""
Cliente da Data API do Aviasales (via Travelpayouts).

Endpoint usado: /aviasales/v3/prices_for_dates
  - Com `destination` em branco, retorna os destinos mais baratos a partir
    da origem (modo "qualquer lugar barato").
  - Token vai no header X-Access-Token.
  - Datas no formato YYYY-MM (mês inteiro) ou YYYY-MM-DD.

Atenção: os dados vêm de CACHE (buscas de usuários nas últimas 48h), então
o preço pode estar levemente defasado. Bom para alerta; confirme no site
da companhia antes de comprar.
"""

import os
import json
import urllib.parse
import urllib.request

import config

BASE_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates"


def _token():
    tok = os.environ.get("TP_TOKEN", "").strip()
    if not tok:
        raise RuntimeError(
            "TP_TOKEN não definido. Configure a variável de ambiente com seu "
            "token do Travelpayouts (Profile -> API token)."
        )
    return tok


def buscar_ofertas(mes_ida):
    """
    Consulta as passagens mais baratas saindo de config.ORIGEM para QUALQUER
    destino no mês `mes_ida` (YYYY-MM).
    Retorna a lista crua de dicts da API (campo "data").
    """
    params = {
        "origin": config.ORIGEM,
        "departure_at": mes_ida,
        "currency": config.MOEDA,
        "sorting": "price",
        "direct": "false",
        "limit": config.LIMITE_POR_MES,
        "page": 1,
        "one_way": "false",
    }
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "X-Access-Token": _token(),
        "Accept-Encoding": "identity",  # evita gzip p/ simplicidade
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[api] Erro ao consultar mês {mes_ida}: {e}")
        return []

    if not payload.get("success", False):
        print(f"[api] API retornou erro p/ {mes_ida}: {payload.get('error')}")
        return []

    dados = payload.get("data", []) or []
    print(f"[api] {mes_ida}: {len(dados)} ofertas recebidas.")
    return dados


def converter_para_brl(preco, moeda_retornada):
    """
    Converte o preço para BRL. Se a API já devolveu em BRL, retorna direto.
    Caso contrário, usa a taxa de fallback de config.TAXAS_FALLBACK.
    """
    moeda = (moeda_retornada or config.MOEDA).lower()
    if moeda == "brl":
        return float(preco)
    taxa = config.TAXAS_FALLBACK.get(moeda)
    if taxa is None:
        # Moeda desconhecida: não dá para confiar. Retorna None p/ descartar.
        print(f"[api] Moeda '{moeda}' sem taxa de fallback. Descartando preço.")
        return None
    return float(preco) * taxa
