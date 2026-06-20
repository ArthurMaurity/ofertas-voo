# -*- coding: utf-8 -*-
"""
Exporta o estado atual do banco para JSONs consumidos pelo frontend React.

Gera dois arquivos em <raiz>/data/:
  deals.json    -> melhores ofertas atuais (cards da Home + pins do mapa)
  history.json  -> série de preços por rota (sparklines)

Chamado ao final de cada execução do main.py, ou avulso:  python export.py
"""

import os
import json
from datetime import datetime, timezone, timedelta

import config
import db
import iata

BRT = timezone(timedelta(hours=-3))

# data/ fica um nível acima de motor/.
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORT_DIR = os.path.join(RAIZ, config.EXPORT_DIR)


def _queda_pct(preco, media):
    """Percentual de queda do preço atual vs a média (0 se sem média/invalido)."""
    if not media or media <= 0 or preco is None:
        return 0.0
    pct = (media - preco) / media * 100.0
    return round(pct, 1) if pct > 0 else 0.0


def _coletar():
    """Monta a lista de ofertas + histórico a partir do banco."""
    origem = config.ORIGEM
    destinos = db.destinos_distintos(origem)

    deals = []
    routes = {}

    for destino in destinos:
        atual = db.melhor_atual(origem, destino)
        if not atual:
            continue

        regiao, pais = iata.regiao_de(destino)
        nome = iata.nome_de(destino)
        lat, lon = iata.coords_de(destino)
        # Sem coordenadas não dá para plotar no mapa nem confiar no destino.
        if lat is None or lon is None:
            continue

        mes_ida = atual.get("mes_ida")
        media, n = db.media_historica(
            origem, destino, mes_ida,
            config.JANELA_MEDIA_DIAS, config.MIN_OBSERVACOES,
        )
        preco = round(atual["preco_brl"], 2)
        teto = config.TETOS_POR_REGIAO.get(regiao, config.TETOS_POR_REGIAO["Outros"])
        queda = _queda_pct(preco, media)

        serie = db.serie_historica(origem, destino, config.MAX_PONTOS_HISTORICO)
        precos = [p["p"] for p in serie] or [preco]

        deal = {
            "destino": destino,
            "cidade": nome,
            "pais": pais,
            "regiao": regiao,
            "lat": lat,
            "lon": lon,
            "preco_brl": preco,
            "media": round(media, 2) if media else None,
            "queda_pct": queda,
            "teto": teto,
            "por_teto": preco <= teto,
            "por_queda": media is not None and queda >= config.QUEDA_PCT * 100,
            "mes_ida": mes_ida,
            "departure_at": atual.get("departure_at"),
            "return_at": atual.get("return_at"),
            "airline": atual.get("airline"),
            "link": _link_aviasales(atual.get("link")),
        }
        deals.append(deal)

        routes[destino] = {
            "destino": destino,
            "cidade": nome,
            "regiao": regiao,
            "lat": lat,
            "lon": lon,
            "preco_atual": preco,
            "media": round(media, 2) if media else None,
            "min": round(min(precos), 2),
            "max": round(max(precos), 2),
            "queda_pct": queda,
            "n_obs": n,
            "serie": serie,
            "link": deal["link"],
        }

    # Melhores ofertas primeiro: maior queda, depois menor preço.
    deals.sort(key=lambda d: (-d["queda_pct"], d["preco_brl"]))
    deals = deals[:config.MAX_DEALS_EXPORT]

    return deals, routes


def _link_aviasales(link_relativo):
    if not link_relativo:
        return None
    if link_relativo.startswith("http"):
        return link_relativo
    return "https://www.aviasales.com" + link_relativo


def _origem_meta():
    return {
        "code": config.ORIGEM,
        "name": config.ORIGEM_NOME,
        "lat": config.ORIGEM_LAT,
        "lon": config.ORIGEM_LON,
    }


def _gravar(nome, conteudo):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    caminho = os.path.join(EXPORT_DIR, nome)
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(conteudo, f, ensure_ascii=False, indent=2)
    print(f"[export] {caminho} ({len(conteudo.get('deals', conteudo.get('routes', [])))} itens)")


def exportar():
    """Gera deals.json e history.json. Retorna (n_deals, n_rotas)."""
    deals, routes = _coletar()
    gerado_em = datetime.now(BRT).isoformat()
    origem = _origem_meta()

    _gravar("deals.json", {
        "generated_at": gerado_em,
        "origin": origem,
        "config": {
            "queda_pct": config.QUEDA_PCT,
            "meses": config.MESES_IDA,
        },
        "deals": deals,
    })
    _gravar("history.json", {
        "generated_at": gerado_em,
        "origin": origem,
        "routes": routes,
    })

    print(f"[export] {len(deals)} ofertas, {len(routes)} rotas exportadas.")
    return len(deals), len(routes)


if __name__ == "__main__":
    db.init_db()
    exportar()
