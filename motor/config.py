# -*- coding: utf-8 -*-
"""
Configuração do monitor de ofertas de voo.
Edite ESTE arquivo para ajustar destinos, tetos e datas — sem mexer na lógica.
"""

# ---------------------------------------------------------------------------
# ORIGEM
# ---------------------------------------------------------------------------
# Código da cidade no padrão IATA. RIO cobre os dois aeroportos do Rio (GIG + SDU).
ORIGEM = "RIO"

# Metadados da origem para o frontend (mapa / hero). Coordenadas do Rio.
ORIGEM_NOME = "Rio de Janeiro"
ORIGEM_LAT = -22.9068
ORIGEM_LON = -43.1729

# ---------------------------------------------------------------------------
# JANELA DE DATAS (Caminho A — "qualquer lugar barato")
# ---------------------------------------------------------------------------
# A API aceita data no formato YYYY-MM (mês inteiro) ou YYYY-MM-DD (dia exato).
# Como queremos "ofertas em qualquer data dentro de uma janela", usamos meses.
# O monitor vai consultar cada mês da lista abaixo.
MESES_IDA = ["2026-07", "2026-08"]

# ---------------------------------------------------------------------------
# MOEDA
# ---------------------------------------------------------------------------
# A API retorna em rublos por padrão. Pedimos BRL; se a API não devolver em BRL,
# o código converte usando a taxa de fallback abaixo.
MOEDA = "brl"
# Taxa de fallback caso a API ignore o parâmetro currency (1 unidade -> BRL).
# Ajuste se necessário. Só é usada se a moeda retornada NÃO for 'brl'.
TAXAS_FALLBACK = {
    "rub": 0.060,   # 1 rublo  ~ R$ 0,06   (ajuste conforme câmbio)
    "usd": 5.40,    # 1 dólar  ~ R$ 5,40
    "eur": 5.85,    # 1 euro   ~ R$ 5,85
}

# ---------------------------------------------------------------------------
# REGIÕES E TETOS DE PREÇO (em BRL)
# ---------------------------------------------------------------------------
# Um destino só vira alerta se o preço ficar ABAIXO do teto da sua região.
# Edite os valores à vontade.
TETOS_POR_REGIAO = {
    "America do Sul":   1500,
    "America do Norte": 3000,
    "America Central":  2500,
    "Europa":           3500,
    "Africa":           4000,
    "Asia":             4500,
    "Oceania":          5500,
    "Outros":           4000,   # qualquer país não mapeado abaixo
}

# Mapeamento de país (código ISO de 2 letras) -> região.
# Lista não exaustiva; países fora daqui caem em "Outros".
PAIS_PARA_REGIAO = {
    # América do Sul
    "AR": "America do Sul", "UY": "America do Sul", "CL": "America do Sul",
    "PY": "America do Sul", "BO": "America do Sul", "PE": "America do Sul",
    "CO": "America do Sul", "EC": "America do Sul", "VE": "America do Sul",
    "GY": "America do Sul", "SR": "America do Sul", "BR": "America do Sul",
    # América Central / Caribe
    "MX": "America Central", "PA": "America Central", "CR": "America Central",
    "CU": "America Central", "DO": "America Central", "GT": "America Central",
    "HN": "America Central", "NI": "America Central", "SV": "America Central",
    "JM": "America Central", "BS": "America Central", "AW": "America Central",
    # América do Norte
    "US": "America do Norte", "CA": "America do Norte",
    # Europa
    "PT": "Europa", "ES": "Europa", "FR": "Europa", "IT": "Europa",
    "DE": "Europa", "GB": "Europa", "NL": "Europa", "BE": "Europa",
    "CH": "Europa", "AT": "Europa", "IE": "Europa", "GR": "Europa",
    "PL": "Europa", "CZ": "Europa", "HU": "Europa", "SE": "Europa",
    "NO": "Europa", "DK": "Europa", "FI": "Europa", "RU": "Europa",
    # África
    "ZA": "Africa", "MA": "Africa", "EG": "Africa", "AO": "Africa",
    "CV": "Africa", "MZ": "Africa", "NG": "Africa", "KE": "Africa",
    # Ásia / Oriente Médio
    "AE": "Asia", "QA": "Asia", "TR": "Asia", "CN": "Asia",
    "JP": "Asia", "TH": "Asia", "IN": "Asia", "SG": "Asia",
    "KR": "Asia", "IL": "Asia",
    # Oceania
    "AU": "Oceania", "NZ": "Oceania",
}

# ---------------------------------------------------------------------------
# GATILHO DE QUEDA vs MÉDIA HISTÓRICA
# ---------------------------------------------------------------------------
# Dispara alerta quando o preço atual está MENOR que (média * (1 - QUEDA_PCT)).
# Só vale quando já existem pelo menos MIN_OBSERVACOES registros para a rota,
# senão uma "média" de 1 ou 2 pontos geraria alarme falso.
QUEDA_PCT = 0.15            # 15% abaixo da média
MIN_OBSERVACOES = 5         # mínimo de leituras antes de confiar na média
JANELA_MEDIA_DIAS = 30      # considera só os últimos N dias no cálculo da média

# ---------------------------------------------------------------------------
# LIMITES / EXECUÇÃO
# ---------------------------------------------------------------------------
# Máximo de destinos retornados por mês consultado (a API aceita até ~1000,
# mas não precisamos de tudo).
LIMITE_POR_MES = 100

# Quantas ofertas, no máximo, notificar por execução (evita spam).
MAX_ALERTAS_POR_RUN = 5

# Não notifica o mesmo destino mais de 1x dentro desta janela (anti-spam).
COOLDOWN_HORAS = 48

# ---------------------------------------------------------------------------
# EXPORTAÇÃO PARA O FRONTEND
# ---------------------------------------------------------------------------
# Pasta onde os JSONs consumidos pelo frontend são gravados (relativa à raiz
# do repositório, um nível acima de motor/).
EXPORT_DIR = "data"

# Máximo de ofertas no deals.json (as melhores, ordenadas por queda/preço).
MAX_DEALS_EXPORT = 60

# Quantos pontos, no máximo, manter por rota no history.json (sparkline).
MAX_PONTOS_HISTORICO = 60
