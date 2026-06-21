// Cloudflare Worker — proxy seguro entre o frontend e a Groq API.
// A GROQ_API_KEY nunca chega ao browser: fica como secret do Worker.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

// Origens autorizadas a chamar o Worker (GitHub Pages + dev local).
const ALLOWED_ORIGINS = [
  'https://arthurmaurity.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
]

const SYSTEM_PROMPT = `Você é um assistente especialista em viagens baratas saindo do Rio de Janeiro.
Você tem acesso às ofertas reais do momento e ao histórico de preços de cada rota.
Ajude o usuário a encontrar a melhor oferta para seu perfil.
Responda sempre em português brasileiro, de forma direta e amigável.
Quando sugerir uma oferta, mostre: destino, preço total (já calculado pelo nº de pessoas),
queda percentual vs histórico, e por que é uma boa oportunidade agora.
Para perguntas sobre destinos (visto, clima, o que fazer), responda com base no seu conhecimento.`

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

// Monta um resumo compacto das ofertas para dar contexto ao modelo sem
// estourar o limite de tokens — preços já multiplicados pelo nº de passageiros.
function buildContext(deals, passengers, budget) {
  const adults = Math.max(1, Number(passengers) || 1)
  const lista = (Array.isArray(deals) ? deals : [])
    .slice(0, 25)
    .map((d) => {
      const total = Math.round((d.preco_brl ?? 0) * adults)
      const queda = d.queda_pct ? `, queda ${d.queda_pct}% vs histórico` : ''
      const media = d.media ? `, média histórica R$ ${Math.round(d.media * adults)}` : ''
      return `- ${d.cidade} (${d.destino}, ${d.regiao}): R$ ${total} total p/ ${adults} adulto(s)${media}${queda}. Ida ${d.departure_at || '?'}, cia ${d.airline || '?'}.`
    })
    .join('\n')

  const orcamento = budget ? `\nOrçamento mencionado pelo usuário: R$ ${budget} (total).` : ''
  return `Passageiros: ${adults} adulto(s).${orcamento}\n\nOfertas disponíveis agora (preço já é o total para ${adults} pessoa(s)):\n${lista || '(sem ofertas no momento)'}`
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    if (request.method !== 'POST') {
      return json({ error: 'Use POST.' }, 405, origin)
    }
    if (!env.GROQ_API_KEY) {
      return json({ error: 'GROQ_API_KEY não configurada no Worker.' }, 500, origin)
    }

    let payload
    try {
      payload = await request.json()
    } catch {
      return json({ error: 'JSON inválido.' }, 400, origin)
    }

    const { messages = [], deals = [], passengers = 1, budget = null } = payload
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages é obrigatório.' }, 400, origin)
    }

    // Mantém só role/content das mensagens do histórico (sanitização).
    const history = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role, content: String(m.content) }))

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: buildContext(deals, passengers, budget) },
      ...history,
    ]

    let groqRes
    try {
      groqRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: chatMessages,
          temperature: 0.6,
          max_tokens: 900,
        }),
      })
    } catch (e) {
      return json({ error: 'Falha ao contatar a Groq.', detail: String(e) }, 502, origin)
    }

    if (!groqRes.ok) {
      const detail = await groqRes.text().catch(() => '')
      return json({ error: `Groq retornou ${groqRes.status}.`, detail }, 502, origin)
    }

    const data = await groqRes.json()
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'Não consegui responder agora. Tenta de novo?'

    return json({ reply }, 200, origin)
  },
}
