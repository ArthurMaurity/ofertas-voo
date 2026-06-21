// Helpers de formatação e apresentação compartilhados.

export function formatBRL(value, { compact = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

export function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function formatDateTimeBR(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// Paleta por região — gera o "visual" do destino sem depender de serviço
// externo (Unsplash/loremflickr). Cada região tem cores próprias e um brilho
// de acento; a posição do brilho varia por destino (hash do IATA) pra que dois
// cards da mesma região não fiquem idênticos. 100% local, sempre confiável.
const REGION_PALETTE = {
  'America do Sul':   { c1: '#0F766E', c2: '#042F2E', glow: 'rgba(45,212,191,0.55)' },
  'America Central':  { c1: '#B45309', c2: '#3B1A06', glow: 'rgba(251,146,60,0.55)' },
  'America do Norte': { c1: '#4338CA', c2: '#1E1B4B', glow: 'rgba(129,140,248,0.55)' },
  'Europa':           { c1: '#1E3A8A', c2: '#0B1733', glow: 'rgba(96,165,250,0.55)' },
  'Asia':             { c1: '#9D174D', c2: '#2B0A1E', glow: 'rgba(244,114,182,0.55)' },
  'Africa':           { c1: '#92670B', c2: '#2E1F05', glow: 'rgba(251,191,36,0.55)' },
  'Outros':           { c1: '#334155', c2: '#0F172A', glow: 'rgba(148,163,184,0.5)'  },
}

// Gradiente CSS temático do destino (substitui a foto externa).
export function regionGradient(deal) {
  const p = REGION_PALETTE[deal?.regiao] || REGION_PALETTE['Outros']
  const seed = hashCode(deal?.destino || deal?.cidade || '')
  const gx = 18 + (seed % 55)        // 18%–72% horizontal
  const gy = 12 + ((seed >> 3) % 45) // 12%–56% vertical
  const angle = 120 + (seed % 50)    // 120°–169°
  return (
    `radial-gradient(circle at ${gx}% ${gy}%, ${p.glow}, transparent 60%), ` +
    `linear-gradient(${angle}deg, ${p.c1}, ${p.c2})`
  )
}

function hashCode(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) % 1000
}

// Cor de acento por intensidade da queda (para badges/realces).
export function dropTone(pct) {
  if (pct >= 30) return 'hot'
  if (pct >= 15) return 'good'
  if (pct > 0) return 'mild'
  return 'flat'
}

export function regionFlagless(region) {
  return region || 'Outros'
}
