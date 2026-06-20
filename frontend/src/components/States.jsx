// Estados reutilizáveis de carregamento / vazio / erro.

export function Loading({ label = 'Buscando ofertas…' }) {
  return (
    <div className="loading-wrap">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function Empty({ emoji = '🧭', title = 'Nada por aqui ainda', children }) {
  return (
    <div className="empty-wrap">
      <div style={{ fontSize: 40 }}>{emoji}</div>
      <strong>{title}</strong>
      {children && <p className="muted" style={{ maxWidth: 280 }}>{children}</p>}
    </div>
  )
}
