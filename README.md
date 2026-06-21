# ✈️ Voa Rio — Monitor de Ofertas de Voo

Autômato que busca passagens baratas saindo do **Rio de Janeiro** para qualquer
destino, guarda o histórico de preços, avisa no **WhatsApp** quando acha oferta
e publica tudo num **app web premium** (React) no GitHub Pages. Roda sozinho na
nuvem (GitHub Actions), de graça, às 8h e 18h.

## Arquitetura

```
ofertas-voo/
├── motor/                  # Motor Python (coleta + alerta + exporta JSON)
│   ├── config.py           #   EDITE AQUI: origem, datas, regiões, tetos, gatilhos
│   ├── main.py             #   orquestra: busca → salva → avalia → notifica → exporta
│   ├── api_client.py       #   cliente da Data API do Aviasales
│   ├── db.py               #   SQLite + média histórica + consultas p/ export
│   ├── iata.py             #   destino → país/região/nome/coordenadas
│   ├── export.py           #   gera data/deals.json e data/history.json
│   ├── notify.py           #   alerta no WhatsApp (CallMeBot), isolado
│   ├── precos.db           #   histórico versionado
│   └── iata_cache.json     #   cache de cidades (país/coords)
├── data/                   # Saída consumida pelo site (versionada)
│   ├── deals.json          #   melhores ofertas atuais (cards + mapa)
│   └── history.json        #   série de preços por rota (sparklines)
├── frontend/               # App React + Vite (mobile-first)
│   └── src/
│       ├── pages/          #   Home, Deal, RoutesPage, Config
│       ├── components/     #   MapHero, DealCard, Sparkline, Badge, ...
│       ├── data/           #   hooks que leem deals.json / history.json
│       └── lib/            #   utils + geometria dos arcos
└── .github/workflows/
    ├── monitor.yml         # coleta 2x/dia + commita banco e JSONs
    └── deploy.yml          # build + deploy do site no GitHub Pages
```

### Fluxo de dados

1. `motor/main.py` consulta a Data API do Aviasales (preços de cache das buscas
   reais nas últimas 48h) e salva cada leitura no SQLite (`motor/precos.db`).
2. Dispara alerta no WhatsApp quando bate um dos gatilhos (teto por região **ou**
   queda ≥ 15% vs média histórica).
3. `motor/export.py` grava `data/deals.json` e `data/history.json`.
4. O workflow `monitor.yml` commita banco + JSONs de volta no repo.
5. O commit em `data/**` dispara `deploy.yml`, que builda o React e publica no Pages.

> ⚠️ Os preços vêm de cache e podem estar algumas horas defasados.
> Use como alerta; confirme o valor real no site da companhia antes de comprar.

---

## 🎨 Frontend

Mobile-first, fundo deep navy (`#0A0F1E`), accent teal (`#00D4AA`), cards com
glassmorphism, mapa MapLibre + OpenFreeMap com arcos animados Rio→destinos, animações com
Framer Motion e sparklines com Recharts.

**Telas:** Home (mapa hero + scroll de ofertas) · Detalhe da oferta (foto, histórico,
botão Aviasales) · Rotas (lista com mini sparkline) · Config (preferências locais).

### Rodar localmente

```bash
cd frontend
npm install
cp ../data/*.json public/data/      # serve os dados no dev server
npm run dev
```

> 🗺️ **Mapa sem configuração.** Usa **MapLibre GL JS + OpenFreeMap** — sem API
> key, sem conta, sem cartão de crédito. Funciona localmente e no deploy sem
> nenhum segredo.

---

## Setup — passo a passo

### 1. Criar o repositório

Crie um repositório no GitHub (ex: `ofertas-voo`) e suba os arquivos.

```bash
cd ofertas-voo
git init
git add .
git commit -m "Voa Rio: motor + frontend"
git branch -M main
git remote add origin https://github.com/ArthurMaurity/ofertas-voo.git
git push -u origin main
```

### 2. Secrets (Settings → Secrets and variables → Actions)

| Secret | Valor |
|---|---|
| `TP_TOKEN` | token do Travelpayouts (Profile → API token) |
| `DESTINATARIOS_WHATS` | JSON dos destinatários do WhatsApp (abaixo) |

**WhatsApp (CallMeBot):** cada número precisa autorizar uma vez —
salve o contato **+34 644 51 95 23**, envie `I allow callmebot to send me messages`
e anote a API key que o bot responde.

```json
[{"nome":"Arthur","phone":"+5521999999999","apikey":"1234567"}]
```

### 3. Ativar o GitHub Pages

Repositório → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
O workflow `deploy.yml` publica em `https://<usuario>.github.io/<repo>/`.

> Se o repositório tiver outro nome, o `base` do Vite é ajustado automaticamente
> pelo workflow (`VITE_BASE=/<nome-do-repo>/`). Para domínio próprio, use `/`.

### 4. Ajustar preferências do motor

Edite `motor/config.py`: `MESES_IDA`, `TETOS_POR_REGIAO`, `QUEDA_PCT`,
`MIN_OBSERVACOES`.

### 5. Testar localmente (opcional)

```bash
cd motor
export TP_TOKEN="seu_token"
export DESTINATARIOS_WHATS='[{"nome":"Arthur","phone":"+5521999999999","apikey":"1234567"}]'
python main.py          # coleta, notifica e regenera os JSONs em ../data/
```

### 6. Deixar rodando

`monitor.yml` já está agendado para **8h e 18h (Brasília)**. Rodar na hora:
aba **Actions → Monitor de ofertas de voo → Run workflow**.

---

## Notas honestas

- **Cache, não tempo real.** Pode haver defasagem; confirme no site da cia.
- **Cobertura do "qualquer lugar".** Depende do que usuários buscaram saindo do
  Rio nas últimas 48h.
- **Moeda.** Pedimos BRL; se vier outra, convertemos por taxa fixa em `config.py`.
- **Fotos dos destinos.** Vêm do loremflickr por palavra-chave (deterministas por
  destino). Troque por uma CDN própria em `frontend/src/lib/utils.js` se quiser curadoria.
- **CallMeBot é serviço de terceiro gratuito.** Se sair do ar, basta reescrever
  `notify.py` para Telegram — o resto não muda.
