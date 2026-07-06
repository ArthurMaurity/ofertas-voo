"""
modulo_zarpo.py

Scraper de preco de referencia para hoteis/pacotes na Zarpo (zarpo.com.br).

LIMITACAO CONHECIDA (nao contornar):
O robots.txt da Zarpo bloqueia qualquer URL com parametro `stay_start=`
para o user-agent generico. Isso significa que este modulo so consegue
pegar o preco de "data sugerida" que a propria Zarpo escolhe para cada
hotel/regiao -- nao a data exata que o usuario final vai pedir no
ofertas-voo. Nao adicionar logica de query string com datas aqui: e
proibido pelo proprio site e o resto do sistema (ofertas-voo) depende
de scraping ficar dentro do que foi autorizado.

PAGINAS PERMITIDAS (confirmado em 2026-07):
  https://www.zarpo.com.br/busca/hoteis/brasil/{estado}/
  https://www.zarpo.com.br/busca/hoteis/internacional/
  https://www.zarpo.com.br/busca/hoteis/sudeste/  (e outras regioes)

Regras de acesso (robots.txt):
  Crawl-delay: 10   -> respeitar SEMPRE, mesmo rodando 1x por dia.
  Disallow: /checkout/*, /payment/*, /booking/*, /cart/*, /order/*
  Disallow: /*?*stay_start=*   -> NUNCA usar esse parametro aqui.

Uso:
    python modulo_zarpo.py --estados sao-paulo,minas-gerais,rio-de-janeiro

Saida:
    zarpo_precos.json  (lista de hoteis com preco de referencia)

Este modulo e pensado para plugar no motor do ofertas-voo como uma
segunda fonte de dado (voo = Travelpayouts, hotel/pacote = Zarpo),
sem exigir nenhuma infra de bypass de bot-detection.
"""

import argparse
import json
import re
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.zarpo.com.br"
CRAWL_DELAY_SECONDS = 10  # respeita o robots.txt, nao reduzir
USER_AGENT = "ofertas-voo-bot/1.0 (+contato: arthur.goulart.2212@gmail.com)"

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "pt-BR,pt;q=0.9",
}


@dataclass
class HotelOferta:
    nome: str
    localizacao: str
    preco_por_noite: float | None
    preco_total: float | None
    desconto_pct: float | None
    link: str
    fonte: str = "zarpo"
    coletado_em: str = ""


def _parse_preco_brl(texto: str) -> float | None:
    """Converte 'R$ 1.505' -> 1505.0. Retorna None se nao achar numero."""
    match = re.search(r"R\$\s*([\d.]+(?:,\d{2})?)", texto)
    if not match:
        return None
    valor = match.group(1).replace(".", "").replace(",", ".")
    try:
        return float(valor)
    except ValueError:
        return None


def buscar_pagina_estado(estado_slug: str, pagina: int = 1) -> str:
    """
    Busca uma pagina de listagem de hoteis por estado/regiao.
    NAO adicionar parametros de data aqui (bloqueado pelo robots.txt).
    """
    url = f"{BASE_URL}/busca/hoteis/brasil/{estado_slug}/"
    params = {"page": pagina} if pagina > 1 else {}
    resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
    resp.raise_for_status()
    return resp.text


def parsear_hoteis(html: str) -> list[HotelOferta]:
    """
    Extrai hoteis do HTML de uma pagina de busca.

    Seletores confirmados via inspecao real do DOM em 2026-07
    (zarpo.com.br/busca/hoteis/brasil/sao-paulo/):
      - card:        article.card-hotel
      - nome:        a.text-decoration-none h4.card-title
      - link:        a.text-decoration-none[href]  (remover query string)
      - localizacao: .card-text.opacity-50  (ex: "Socorro, SP")
      - preco/noite: .hotel-from-price .text-primary
      - preco total: .hotel-from-price .text-success
      - desconto:    texto livre "NN% off" em qualquer lugar do card

    Se a Zarpo mudar o markup, este e o unico lugar que precisa mudar.
    """
    soup = BeautifulSoup(html, "html.parser")
    hoteis: list[HotelOferta] = []

    cards = soup.select("article.card-hotel")

    for card in cards:
        link_tag = card.select_one("a.text-decoration-none[href]")
        link = ""
        if link_tag:
            href = link_tag["href"].split("?")[0]
            link = href if href.startswith("http") else BASE_URL + href

        nome_tag = card.select_one("h4.card-title")
        nome = nome_tag.get_text(strip=True) if nome_tag else "desconhecido"

        loc_tag = card.select_one(".card-text.opacity-50")
        localizacao = loc_tag.get_text(strip=True) if loc_tag else ""

        preco_noite_tag = card.select_one(".hotel-from-price .text-primary")
        preco_total_tag = card.select_one(".hotel-from-price .text-success")
        preco_noite = _parse_preco_brl(preco_noite_tag.get_text()) if preco_noite_tag else None
        preco_total = _parse_preco_brl(preco_total_tag.get_text()) if preco_total_tag else None

        texto_completo = card.get_text(" ", strip=True)
        desconto_match = re.search(r"(\d+)%\s*off", texto_completo, re.I)
        desconto = float(desconto_match.group(1)) if desconto_match else None

        if nome == "desconhecido" and not link:
            continue  # card vazio/anomalo, pula

        hoteis.append(HotelOferta(
            nome=nome,
            localizacao=localizacao,
            preco_por_noite=preco_noite,
            preco_total=preco_total,
            desconto_pct=desconto,
            link=link,
            coletado_em=datetime.now(timezone.utc).isoformat(),
        ))

    return hoteis


def coletar_estado(estado_slug: str, max_paginas: int = 3) -> list[HotelOferta]:
    todos: list[HotelOferta] = []
    for pagina in range(1, max_paginas + 1):
        html = buscar_pagina_estado(estado_slug, pagina)
        hoteis = parsear_hoteis(html)
        if not hoteis:
            break  # provavelmente acabaram as paginas
        todos.extend(hoteis)
        time.sleep(CRAWL_DELAY_SECONDS)  # respeita Crawl-delay: 10
    return todos


def main():
    parser = argparse.ArgumentParser(description="Coleta precos de referencia de hoteis na Zarpo")
    parser.add_argument(
        "--estados",
        default="sao-paulo,rio-de-janeiro,minas-gerais",
        help="Lista de slugs de estado separados por virgula (ex: sao-paulo,bahia)",
    )
    parser.add_argument("--saida", default="zarpo_precos.json")
    args = parser.parse_args()

    estados = [e.strip() for e in args.estados.split(",") if e.strip()]
    resultado: list[dict] = []

    for estado in estados:
        print(f"Coletando {estado}...")
        hoteis = coletar_estado(estado)
        resultado.extend(asdict(h) for h in hoteis)
        time.sleep(CRAWL_DELAY_SECONDS)

    with open(args.saida, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f"{len(resultado)} ofertas salvas em {args.saida}")


if __name__ == "__main__":
    main()
