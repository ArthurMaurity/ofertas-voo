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
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

import config

# Backoff entre tentativas (s). len() define o nº máximo de tentativas.
_BACKOFF = [5, 15, 30]


def _get_json(req):
    """GET com retry/backoff. Só retenta em erro de rede ou status 5xx."""
    tentativas = len(_BACKOFF) + 1
    for i in range(tentativas):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code < 500 or i == tentativas - 1:
                raise  # 4xx não adianta retentar; última tentativa propaga
            espera, motivo = _BACKOFF[i], f"HTTP {e.code}"
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if i == tentativas - 1:
                raise
            espera, motivo = _BACKOFF[i], str(e) or "erro de rede"
        print(f"[api] Tentativa {i + 2}/{tentativas} após erro: {motivo}")
        time.sleep(espera)

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
        payload = _get_json(req)
    except Exception as e:
        print(f"[api] Erro ao consultar mês {mes_ida}: {e}")
        return []

    if not payload.get("success", False):
        print(f"[api] API retornou erro p/ {mes_ida}: {payload.get('error')}")
        return []

    dados = payload.get("data", []) or []
    print(f"[api] {mes_ida}: {len(dados)} ofertas recebidas.")
    return dados


CHEAP_URL = "https://api.travelpayouts.com/v1/prices/cheap"


def _shift(data, dias):
    """Desloca 'YYYY-MM-DD' em N dias."""
    return (datetime.strptime(data, "%Y-%m-%d") + timedelta(days=dias)).strftime("%Y-%m-%d")


def buscar_rota_data(origem, destino, data_ida, data_volta=None):
    """
    Busca a rota na data exata via v1/prices/cheap.
    O cache do Travelpayouts retorna vazio com frequência em data exata, então
    tenta também +-1 e +-2 dias antes de desistir. Retorna a oferta mais barata
    no mesmo formato de buscar_ofertas(), ou None.
    """
    for off in (0, 1, -1, 2, -2):
        params = {
            "origin": origem,
            "destination": destino,
            "depart_date": _shift(data_ida, off),
            "currency": config.MOEDA,
        }
        if data_volta:
            params["return_date"] = _shift(data_volta, off)
        url = CHEAP_URL + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={
            "X-Access-Token": _token(),
            "Accept-Encoding": "identity",
        })
        try:
            payload = _get_json(req)
        except Exception as e:
            print(f"[api] Erro rota {origem}->{destino} ({off:+d}d): {e}")
            continue
        vos = payload.get("data", {}).get(destino) or {}
        if not vos:
            continue
        v = min(vos.values(), key=lambda o: o.get("price", float("inf")))
        if off:
            print(f"[api] {origem}->{destino}: vazio na data exata, achou com {off:+d} dia(s).")
        return {
            "destination": destino,
            "price": v.get("price"),
            "currency": config.MOEDA,
            "departure_at": v.get("departure_at"),
            "return_at": v.get("return_at"),
            "airline": v.get("airline"),
            "link": None,
        }
    print(f"[api] {origem}->{destino} {data_ida}: sem oferta mesmo com +-2 dias.")
    return None


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
