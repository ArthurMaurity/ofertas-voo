# ofertas-voo-agent (Cloudflare Worker)

Proxy seguro entre o frontend e a [Groq API](https://console.groq.com/). A
`GROQ_API_KEY` fica como **secret do Worker** — nunca vai para o browser nem
para o repositório.

## Endpoint

`POST /` com corpo JSON:

```json
{
  "messages":   [{ "role": "user", "content": "..." }],
  "deals":      [ /* deals.json atual */ ],
  "passengers": 2,
  "budget":     3000
}
```

Resposta: `{ "reply": "..." }`. Modelo: `llama-3.3-70b-versatile`.

## Deploy

```bash
cd worker
npm i -g wrangler            # se ainda não tiver
wrangler login

# Define a chave como SECRET (não fica em arquivo nenhum):
wrangler secret put GROQ_API_KEY

wrangler deploy
```

Após o deploy, copie a URL pública do Worker e aponte o frontend para ela via
`VITE_AGENT_URL` (veja `frontend/.env.example`).

## Dev local

```bash
cp .dev.vars.example .dev.vars   # preencha GROQ_API_KEY (arquivo é gitignored)
wrangler dev
```

## Segurança

- CORS liberado só para o domínio do GitHub Pages e `localhost` de dev.
- `wrangler.toml` tem `GROQ_API_KEY = ""` apenas como placeholder/documentação;
  o valor real vem sempre de `wrangler secret put` (produção) ou `.dev.vars` (local),
  ambos fora do controle de versão.
