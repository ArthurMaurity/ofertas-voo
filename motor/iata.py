# -*- coding: utf-8 -*-
"""
Resolve o código IATA de um destino (cidade/aeroporto) para país, região,
nome amigável e coordenadas geográficas.

Usa o arquivo público de cidades da Travelpayouts:
  https://api.travelpayouts.com/data/en/cities.json
Baixa uma vez e guarda em cache local (iata_cache.json) para não repetir.

O cache agora guarda um registro rico por código:
  {"LIS": {"country": "PT", "name": "Lisbon", "lat": 38.78, "lon": -9.13}}
Se um cache antigo (formato {code: country}) for encontrado, ele é descartado
e reconstruído automaticamente.
"""

import os
import json
import urllib.request

import config

CACHE_PATH = os.path.join(os.path.dirname(__file__), "iata_cache.json")
CITIES_URL = "https://api.travelpayouts.com/data/en/cities.json"

_mapa = None  # carregado sob demanda: {code: {country, name, lat, lon}}


def _baixar_cidades():
    """Baixa o JSON de cidades e monta {IATA: {country, name, lat, lon}}."""
    print("[iata] Baixando base de cidades da Travelpayouts...")
    try:
        with urllib.request.urlopen(CITIES_URL, timeout=60) as resp:
            cidades = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[iata] Falha ao baixar cidades: {e}")
        return {}
    mapa = {}
    for c in cidades:
        code = c.get("code")
        pais = c.get("country_code")
        if not (code and pais):
            continue
        coord = c.get("coordinates") or {}
        nome = c.get("name") or code
        mapa[code] = {
            "country": pais,
            "name": nome,
            "lat": coord.get("lat"),
            "lon": coord.get("lon"),
        }
    print(f"[iata] {len(mapa)} cidades mapeadas.")
    return mapa


def _formato_valido(dados):
    """True se o cache estiver no formato rico (dict de dicts)."""
    if not isinstance(dados, dict) or not dados:
        return False
    amostra = next(iter(dados.values()))
    return isinstance(amostra, dict) and "country" in amostra


def _carregar():
    global _mapa
    if _mapa is not None:
        return _mapa
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                dados = json.load(f)
            if _formato_valido(dados):
                _mapa = dados
                return _mapa
            print("[iata] Cache em formato antigo. Reconstruindo...")
        except Exception:
            pass
    _mapa = _baixar_cidades()
    if _mapa:
        try:
            with open(CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(_mapa, f)
        except Exception as e:
            print(f"[iata] Não consegui salvar cache: {e}")
    return _mapa


def info_de(destino_iata):
    """Retorna o registro {country, name, lat, lon} ou None."""
    return _carregar().get(destino_iata)


def pais_de(destino_iata):
    """Retorna o código ISO do país do destino, ou None se desconhecido."""
    rec = info_de(destino_iata)
    return rec.get("country") if rec else None


def nome_de(destino_iata):
    """Nome amigável da cidade, com fallback para o próprio código."""
    rec = info_de(destino_iata)
    return (rec.get("name") if rec else None) or destino_iata


def coords_de(destino_iata):
    """Tupla (lat, lon) do destino, ou (None, None)."""
    rec = info_de(destino_iata)
    if not rec:
        return None, None
    return rec.get("lat"), rec.get("lon")


def regiao_de(destino_iata):
    """Retorna a região (chave de config.TETOS_POR_REGIAO) do destino."""
    pais = pais_de(destino_iata)
    if not pais:
        return "Outros", None
    regiao = config.PAIS_PARA_REGIAO.get(pais, "Outros")
    return regiao, pais
