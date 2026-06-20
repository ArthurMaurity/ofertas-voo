# -*- coding: utf-8 -*-
"""
Notificação via WhatsApp usando o serviço gratuito CallMeBot.

COMO FUNCIONA O CALLMEBOT (uso pessoal/familiar):
  Cada número que vai RECEBER mensagens precisa autorizar uma única vez:
    1. Adicione o número +34 644 51 95 23 (CallMeBot) aos contatos do WhatsApp.
    2. Envie a mensagem:  I allow callmebot to send me messages
    3. O bot responde com uma API key pessoal daquele número.
  Depois disso, basta o número de telefone (com DDI) + a API key.

Os destinatários ficam na variável de ambiente DESTINATARIOS_WHATS (JSON),
para nunca colocar telefone/key no código. Veja o README.

Esta função é DE PROPÓSITO isolada: se um dia o CallMeBot sair do ar,
basta reescrever `enviar_mensagem` para Telegram sem tocar no resto.
"""

import os
import json
import time
import urllib.parse
import urllib.request


def _carregar_destinatarios():
    """
    Lê DESTINATARIOS_WHATS do ambiente. Formato esperado (JSON):
      [{"nome": "Arthur", "phone": "+5521999999999", "apikey": "123456"}]
    """
    raw = os.environ.get("DESTINATARIOS_WHATS", "").strip()
    if not raw:
        return []
    try:
        dados = json.loads(raw)
        if isinstance(dados, list):
            return dados
    except json.JSONDecodeError:
        print("[notify] DESTINATARIOS_WHATS não é um JSON válido. Ignorando.")
    return []


def enviar_mensagem(texto):
    """
    Envia `texto` para todos os destinatários configurados via CallMeBot.
    Retorna o número de envios bem-sucedidos.
    """
    destinatarios = _carregar_destinatarios()
    if not destinatarios:
        print("[notify] Nenhum destinatário configurado (DESTINATARIOS_WHATS vazio).")
        return 0

    enviados = 0
    for d in destinatarios:
        phone = str(d.get("phone", "")).replace("+", "").replace(" ", "")
        apikey = str(d.get("apikey", "")).strip()
        nome = d.get("nome", phone)
        if not phone or not apikey:
            print(f"[notify] Destinatário '{nome}' sem phone/apikey. Pulando.")
            continue

        url = (
            "https://api.callmebot.com/whatsapp.php?"
            + urllib.parse.urlencode({
                "phone": phone,
                "text": texto,
                "apikey": apikey,
            })
        )
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                corpo = resp.read().decode("utf-8", errors="ignore")
            # CallMeBot devolve texto simples; "Message queued" / "Message Sent" = ok.
            if "queued" in corpo.lower() or "sent" in corpo.lower() or resp.status == 200:
                print(f"[notify] OK -> {nome}")
                enviados += 1
            else:
                print(f"[notify] Resposta inesperada p/ {nome}: {corpo[:120]}")
        except Exception as e:
            print(f"[notify] Falha ao enviar p/ {nome}: {e}")

        # CallMeBot pede um respiro entre mensagens.
        time.sleep(3)

    return enviados


if __name__ == "__main__":
    # Teste manual: python notify.py
    n = enviar_mensagem("Teste do monitor de ofertas de voo ✈️")
    print(f"Enviados: {n}")
