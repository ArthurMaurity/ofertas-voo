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

// Foto temática do destino. loremflickr serve fotos do Flickr por palavra-chave
// de forma determinística (lock = código IATA), então cada destino tem sempre
// a mesma imagem. Troque por uma CDN própria/Unsplash se quiser curadoria.
export function photoUrl(deal, w = 800, h = 600) {
  const key = encodeURIComponent(
    `${(deal.cidade || deal.destino || 'travel').split(' ')[0]},travel,city`
  )
  return `https://loremflickr.com/${w}/${h}/${key}?lock=${hashCode(deal.destino)}`
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
