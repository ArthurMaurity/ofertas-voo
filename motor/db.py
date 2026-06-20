# -*- coding: utf-8 -*-
"""
Camada de persistência (SQLite).
Guarda cada observação de preço e calcula a média histórica por rota.
"""

import os
import sqlite3
from datetime import datetime, timedelta

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "precos.db"))


def conectar():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Cria a tabela se ainda não existir."""
    with conectar() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS observacoes (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                coletado_em   TEXT NOT NULL,      -- timestamp ISO da coleta
                origem        TEXT NOT NULL,
                destino       TEXT NOT NULL,      -- IATA do destino
                pais          TEXT,               -- código ISO do país
                regiao        TEXT,
                mes_ida       TEXT,               -- YYYY-MM consultado
                preco_brl     REAL NOT NULL,      -- preço já convertido p/ BRL
                moeda_origem  TEXT,               -- moeda devolvida pela API
                departure_at  TEXT,
                return_at     TEXT,
                airline       TEXT,
                link          TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_rota
            ON observacoes (origem, destino, mes_ida)
        """)
    print(f"[db] Banco pronto em {DB_PATH}")


def salvar_observacao(obs):
    """Insere uma observação (dict). Retorna o id criado."""
    with conectar() as conn:
        cur = conn.execute("""
            INSERT INTO observacoes
              (coletado_em, origem, destino, pais, regiao, mes_ida,
               preco_brl, moeda_origem, departure_at, return_at, airline, link)
            VALUES
              (:coletado_em, :origem, :destino, :pais, :regiao, :mes_ida,
               :preco_brl, :moeda_origem, :departure_at, :return_at, :airline, :link)
        """, obs)
        return cur.lastrowid


def media_historica(origem, destino, mes_ida, janela_dias, min_observacoes):
    """
    Retorna (media, n) dos preços da rota nos últimos `janela_dias`.
    Se houver menos de `min_observacoes` registros, retorna (None, n)
    para sinalizar que ainda não dá para confiar na média.
    O registro recém-inserido NÃO deve entrar aqui — chame ANTES de salvar
    o atual, ou filtre pelo tempo.
    """
    limite = (datetime.utcnow() - timedelta(days=janela_dias)).isoformat()
    with conectar() as conn:
        row = conn.execute("""
            SELECT AVG(preco_brl) AS media, COUNT(*) AS n
            FROM observacoes
            WHERE origem = ? AND destino = ? AND mes_ida = ?
              AND coletado_em >= ?
        """, (origem, destino, mes_ida, limite)).fetchone()
    n = row["n"] or 0
    if n < min_observacoes:
        return None, n
    return row["media"], n


# ---------------------------------------------------------------------------
# Consultas de leitura para exportação ao frontend.
# ---------------------------------------------------------------------------

def destinos_distintos(origem):
    """Lista os códigos IATA de destino já observados para a origem."""
    with conectar() as conn:
        rows = conn.execute(
            "SELECT DISTINCT destino FROM observacoes WHERE origem = ?",
            (origem,),
        ).fetchall()
    return [r["destino"] for r in rows]


def melhor_atual(origem, destino):
    """
    Devolve a observação mais barata da coleta mais recente da rota
    (a "oferta atual"), como dict — ou None se não houver dados.
    """
    with conectar() as conn:
        ultimo = conn.execute(
            """SELECT MAX(coletado_em) AS m FROM observacoes
               WHERE origem = ? AND destino = ?""",
            (origem, destino),
        ).fetchone()
        if not ultimo or not ultimo["m"]:
            return None
        row = conn.execute(
            """SELECT * FROM observacoes
               WHERE origem = ? AND destino = ? AND coletado_em = ?
               ORDER BY preco_brl ASC LIMIT 1""",
            (origem, destino, ultimo["m"]),
        ).fetchone()
    return dict(row) if row else None


def serie_historica(origem, destino, limite_pontos):
    """
    Série temporal de preço (o mais barato por coleta) para a rota,
    em ordem cronológica. Retorna lista de {"t": coletado_em, "p": preco_brl}.
    """
    with conectar() as conn:
        rows = conn.execute(
            """SELECT coletado_em, MIN(preco_brl) AS preco
               FROM observacoes
               WHERE origem = ? AND destino = ?
               GROUP BY coletado_em
               ORDER BY coletado_em ASC""",
            (origem, destino),
        ).fetchall()
    serie = [{"t": r["coletado_em"], "p": round(r["preco"], 2)} for r in rows]
    # Mantém apenas os últimos N pontos para o sparkline não ficar pesado.
    if limite_pontos and len(serie) > limite_pontos:
        serie = serie[-limite_pontos:]
    return serie
