# -*- coding: utf-8 -*-
"""
Monitor de ofertas de voo — orquestrador principal.

Fluxo de cada execução:
  1. Para cada mês da janela, busca as passagens mais baratas saindo do Rio
     para QUALQUER destino (API de cache do Aviasales).
  2. Para cada oferta:
       - resolve região/país do destino
       - converte preço para BRL
       - calcula a média histórica da rota (ANTES de salvar a leitura atual)
       - salva a leitura no histórico (SQLite)
       - avalia os DOIS gatilhos:
            (a) TETO  : preço abaixo do teto da região
            (b) QUEDA : preço >=15% abaixo da média (só com histórico suficiente)
  3. Junta os alertas, monta uma mensagem e envia no WhatsApp.

Rode localmente com:  python main.py
"""

from datetime import datetime, timezone, timedelta
import json
import os
import sys
import urllib.parse
import urllib.request

# modulo_zarpo mora na raiz do repositório, um nível acima de motor/.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
import db
import iata
import api_client
import notify
import export

# Fuso de Brasília (UTC-3) só para exibir horário amigável na mensagem.
BRT = timezone(timedelta(hours=-3))


def avaliar_oferta(oferta):
    """
    Recebe uma oferta crua da API e devolve um dict normalizado + flags de
    alerta, ou None se a oferta deve ser ignorada.
    """
    destino = oferta.get("destination")
    preco_raw = oferta.get("price")
    if not destino or preco_raw is None:
        return None

    moeda = oferta.get("currency") or config.MOEDA
    preco_brl = api_client.converter_para_brl(preco_raw, moeda)
    if preco_brl is None:
        return None

    regiao, pais = iata.regiao_de(destino)
    teto = config.TETOS_POR_REGIAO.get(regiao, config.TETOS_POR_REGIAO["Outros"])

    return {
        "destino": destino,
        "pais": pais,
        "regiao": regiao,
        "preco_brl": round(preco_brl, 2),
        "teto": teto,
        "moeda_origem": moeda,
        "departure_at": oferta.get("departure_at"),
        "return_at": oferta.get("return_at"),
        "airline": oferta.get("airline"),
        "link": oferta.get("link"),
    }


def link_aviasales(link_relativo):
    """A API devolve um caminho relativo; prefixa com o domínio do Aviasales."""
    if not link_relativo:
        return None
    return "https://www.aviasales.com" + link_relativo


def encurtar_link(url):
    """Encurta via TinyURL (GET, sem auth). Se falhar, devolve o link original."""
    if not url:
        return url
    try:
        api = "https://tinyurl.com/api-create.php?" + urllib.parse.urlencode({"url": url})
        with urllib.request.urlopen(api, timeout=10) as resp:
            curto = resp.read().decode("utf-8").strip()
        return curto if curto.startswith("http") else url
    except Exception:
        return url  # ponytail: link feio é melhor que link ausente


def avaliar_e_registrar(oferta, mes_ida, agora_iso):
    """
    Normaliza a oferta, salva no histórico e avalia os gatilhos.
    Devolve o alerta (dict) ou None se a oferta não bateu gatilho/é inválida.
    """
    norm = avaliar_oferta(oferta)
    if not norm:
        return None

    # 1) Média histórica ANTES de inserir a leitura atual.
    media, n = db.media_historica(
        config.ORIGEM, norm["destino"], mes_ida,
        config.JANELA_MEDIA_DIAS, config.MIN_OBSERVACOES,
    )

    # 2) Salva a leitura atual no histórico.
    db.salvar_observacao({
        "coletado_em": agora_iso,
        "origem": config.ORIGEM,
        "destino": norm["destino"],
        "pais": norm["pais"],
        "regiao": norm["regiao"],
        "mes_ida": mes_ida,
        "preco_brl": norm["preco_brl"],
        "moeda_origem": norm["moeda_origem"],
        "departure_at": norm["departure_at"],
        "return_at": norm["return_at"],
        "airline": norm["airline"],
        "link": norm["link"],
    })

    # 3) Avalia os dois gatilhos.
    gatilho_teto = norm["preco_brl"] <= norm["teto"]
    gatilho_queda = False
    if media is not None:
        limite_queda = media * (1 - config.QUEDA_PCT)
        gatilho_queda = norm["preco_brl"] <= limite_queda

    if not (gatilho_teto or gatilho_queda):
        return None

    norm["mes_ida"] = mes_ida
    norm["media"] = round(media, 2) if media else None
    norm["n_obs"] = n
    norm["por_teto"] = gatilho_teto
    norm["por_queda"] = gatilho_queda
    norm["queda_pct"] = (
        (media - norm["preco_brl"]) / media if (media and gatilho_queda) else 0.0
    )
    return norm


def processar_mes(mes_ida, agora_iso):
    """Processa um mês e devolve a lista de alertas encontrados."""
    alertas = []
    for oferta in api_client.buscar_ofertas(mes_ida):
        alerta = avaliar_e_registrar(oferta, mes_ida, agora_iso)
        if alerta:
            alertas.append(alerta)
    return alertas


def processar_rotas(agora_iso):
    """
    Rotas de config.json com data exata (data_ida preenchida).
    Rotas sem data já são cobertas pela busca mensal — pula sem erro.
    """
    alertas = []
    for rota in config.ROTAS:
        if not rota.get("data_ida"):
            continue
        oferta = api_client.buscar_rota_data(
            rota.get("origem", config.ORIGEM), rota["destino"],
            rota["data_ida"], rota.get("data_volta"),
        )
        if not oferta:
            continue
        alerta = avaliar_e_registrar(oferta, rota["data_ida"][:7], agora_iso)
        if alerta:
            alertas.append(alerta)
    return alertas


def coletar_hoteis():
    """
    Coleta preços de referência na Zarpo (SEQUENCIAL, Crawl-delay 10s do
    robots.txt — não acelerar) e salva em data/hoteis.json.
    """
    if not config.ZARPO_ESTADOS:
        return
    import time
    from dataclasses import asdict
    import modulo_zarpo

    hoteis = []
    for estado in config.ZARPO_ESTADOS:
        print(f"[zarpo] Coletando {estado}...")
        try:
            hoteis.extend(asdict(h) for h in modulo_zarpo.coletar_estado(estado))
        except Exception as e:
            print(f"[zarpo] Falha em {estado}: {e}")
        time.sleep(modulo_zarpo.CRAWL_DELAY_SECONDS)

    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    destino = os.path.join(raiz, config.EXPORT_DIR, "hoteis.json")
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(hoteis, f, ensure_ascii=False, indent=2)
    print(f"[zarpo] {len(hoteis)} hotéis salvos em {destino}")


def formatar_mensagem(alertas):
    """Monta o texto do WhatsApp a partir da lista de alertas."""
    agora = datetime.now(BRT).strftime("%d/%m %H:%M")
    linhas = [f"✈️ Ofertas saindo do Rio — {agora}", ""]

    for a in alertas:
        motivo = []
        if a["por_teto"]:
            motivo.append("abaixo do teto")
        if a["por_queda"]:
            motivo.append(f"caiu {config.QUEDA_PCT*100:.0f}%+ vs média R${a['media']:.0f}")
        motivo_txt = " | ".join(motivo)

        dep = (a.get("departure_at") or "")[:10]
        linhas.append(
            f"• {a['destino']} ({a['regiao']}) — R$ {a['preco_brl']:.0f}"
            f"  [{motivo_txt}]"
            + (f"\n  ida {dep}" if dep else "")
            + (f"\n  🔗 {encurtar_link(link_aviasales(a['link']))}" if a.get("link") else "")
        )
    return "\n".join(linhas)


def main():
    print("=== Monitor de ofertas de voo ===")
    db.init_db()
    agora_iso = datetime.utcnow().isoformat()

    todos_alertas = []
    for mes in config.MESES_IDA:
        todos_alertas.extend(processar_mes(mes, agora_iso))
    todos_alertas.extend(processar_rotas(agora_iso))

    # Hotéis (Zarpo) DEPOIS dos voos, sequencial — fonte diferente, mas
    # mantém os rate-limits separados na mesma execução.
    try:
        coletar_hoteis()
    except Exception as e:
        print(f"[main] Falha na coleta Zarpo (segue sem hotéis): {e}")

    # Deduplica por destino, mantendo sempre a oferta mais barata.
    melhor_por_destino = {}
    for a in todos_alertas:
        atual = melhor_por_destino.get(a["destino"])
        if atual is None or a["preco_brl"] < atual["preco_brl"]:
            melhor_por_destino[a["destino"]] = a
    todos_alertas = list(melhor_por_destino.values())

    print(f"[main] {len(todos_alertas)} alertas no total (após dedup).")

    # Exporta os JSONs para o frontend SEMPRE — mesmo sem alertas, o site
    # precisa refletir os preços mais recentes coletados nesta execução.
    try:
        export.exportar()
    except Exception as e:
        print(f"[main] Falha ao exportar JSON do frontend: {e}")

    if not todos_alertas:
        print("[main] Nenhuma oferta bateu os gatilhos nesta execução.")
        return

    # COOLDOWN: só destinos "frescos" (não notificados nas últimas N horas).
    em_cooldown = db.destinos_em_cooldown(config.COOLDOWN_HORAS)
    frescos = [a for a in todos_alertas if a["destino"] not in em_cooldown]
    if len(frescos) < len(todos_alertas):
        print(f"[main] {len(todos_alertas) - len(frescos)} destino(s) em cooldown, ignorados.")

    # Prioriza QUEDA sobre só-TETO; dentro de cada grupo, maior queda % primeiro.
    # Limita a quantidade enviada ao WhatsApp (anti-spam).
    selecionados = sorted(
        frescos,
        key=lambda a: (not a["por_queda"], -a["queda_pct"]),
    )[:config.MAX_ALERTAS_POR_RUN]

    if not selecionados:
        print("[main] Nada novo para notificar (tudo em cooldown).")
        return

    mensagem = formatar_mensagem(selecionados)
    print("[main] Mensagem montada:\n" + mensagem)
    enviados = notify.enviar_mensagem(mensagem)
    print(f"[main] Notificações enviadas: {enviados}")

    # Só registra o cooldown se o envio realmente saiu; se falhou, os destinos
    # continuam elegíveis na próxima execução.
    if enviados > 0:
        db.registrar_notificacoes([a["destino"] for a in selecionados], agora_iso)


if __name__ == "__main__":
    main()
