import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDeals } from '../data/useData'
import { usePassengers } from '../context/PassengersContext'
import './AgentChat.css'

const AGENT_URL = import.meta.env.VITE_AGENT_URL || ''

const WELCOME = {
  role: 'assistant',
  content:
    'Olá! 👋 Sou seu assistente de viagens. Me diz seu destino, orçamento e quantas pessoas — eu encontro a melhor oferta disponível agora.',
}

// Extrai um orçamento (R$) mencionado no texto. Aceita "3000", "R$ 3.000",
// "3 mil". Retorna número ou null.
function parseBudget(text) {
  const t = text.toLowerCase()
  const mil = t.match(/(\d+(?:[.,]\d+)?)\s*mil/)
  if (mil) return Math.round(parseFloat(mil[1].replace(',', '.')) * 1000)
  // "3.000", "3 000" (milhar) ou "3000" puro. Ignora centavos após vírgula.
  const reais = t.match(/r?\$?\s*(\d{1,3}(?:[.\s]\d{3})+|\d{3,})/)
  if (reais) {
    const n = parseInt(reais[1].replace(/[.\s]/g, ''), 10)
    if (!Number.isNaN(n) && n >= 100) return n
  }
  return null
}

export default function AgentChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [budget, setBudget] = useState(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const scrollRef = useRef(null)

  const { deals } = useDeals()
  const { adults } = usePassengers()

  // No desktop (>=1024px) o chat é um painel lateral fixo, não um drawer de baixo.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Quando o painel está aberto no desktop, desloca o conteúdo para não sobrepor.
  useEffect(() => {
    document.body.classList.toggle('agent-panel-open', open && isDesktop)
    return () => document.body.classList.remove('agent-panel-open')
  }, [open, isDesktop])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading, open])

  // Animação: sobe de baixo no mobile/tablet; entra pela direita no desktop.
  const hidden = isDesktop ? { x: '100%' } : { y: '100%' }
  const shown = isDesktop ? { x: 0 } : { y: 0 }

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const nextBudget = parseBudget(text) ?? budget
    if (nextBudget !== budget) setBudget(nextBudget)

    const userMsg = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      if (!AGENT_URL) throw new Error('Assistente não configurado (VITE_AGENT_URL ausente).')
      const res = await fetch(AGENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.filter((m) => m.role !== 'assistant' || m !== WELCOME),
          deals,
          passengers: adults,
          budget: nextBudget,
        }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || '...' }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ Não consegui responder agora. ${e.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, deals, adults, budget])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="agent-root">
      {/* Botão flutuante */}
      <motion.button
        className="agent-fab"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        aria-label="Abrir assistente de viagens"
        animate={open ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      >
        <span className="agent-fab-icon">✨</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {!isDesktop && (
              <motion.div
                className="agent-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              />
            )}
            <motion.div
              className="agent-drawer glass"
              initial={hidden}
              animate={shown}
              exit={hidden}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <header className="agent-head">
                <div className="agent-head-title">
                  <span className="agent-avatar">✨</span>
                  <div>
                    <strong>Assistente de viagens</strong>
                    <span className="agent-sub faint">
                      {adults} adulto(s){budget ? ` · orçamento R$ ${budget}` : ''}
                    </span>
                  </div>
                </div>
                <button className="agent-close" onClick={() => setOpen(false)} aria-label="Fechar">
                  ✕
                </button>
              </header>

              <div className="agent-scroll" ref={scrollRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`agent-msg ${m.role}`}>
                    <div className="agent-bubble">
                      <Markdown text={m.content} />
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="agent-msg assistant">
                    <div className="agent-bubble">
                      <span className="agent-dots"><i /><i /><i /></span>
                    </div>
                  </div>
                )}
              </div>

              <div className="agent-input-row">
                <input
                  className="agent-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Pergunte sobre destinos, preços, orçamento…"
                  autoFocus
                />
                <motion.button
                  className="agent-send"
                  onClick={send}
                  disabled={loading || !input.trim()}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Enviar"
                >
                  ↑
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// Markdown mínimo: **negrito**, listas com - ou *, e quebras de linha.
function Markdown({ text }) {
  const lines = String(text).split('\n')
  const out = []
  let bullets = null

  const flush = () => {
    if (bullets) {
      out.push(<ul key={`ul-${out.length}`} className="agent-ul">{bullets}</ul>)
      bullets = null
    }
  }

  lines.forEach((line, i) => {
    const m = line.match(/^\s*[-*]\s+(.*)$/)
    if (m) {
      bullets = bullets || []
      bullets.push(<li key={i}>{inline(m[1])}</li>)
    } else {
      flush()
      if (line.trim()) out.push(<p key={i}>{inline(line)}</p>)
    }
  })
  flush()
  return <>{out}</>
}

// Negrito **assim**.
function inline(str) {
  const parts = str.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}
