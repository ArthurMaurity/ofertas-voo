import { createContext, useContext, useState, useMemo, useCallback } from 'react'

// Estado global de passageiros. A API/motor sempre retorna preço unitário
// (1 adulto); a multiplicação acontece no frontend ao exibir os valores.
const MIN = 1
const MAX = 6

const PassengersContext = createContext(null)

export function PassengersProvider({ children }) {
  const [adults, setAdults] = useState(1)

  const inc = useCallback(() => setAdults((n) => Math.min(MAX, n + 1)), [])
  const dec = useCallback(() => setAdults((n) => Math.max(MIN, n - 1)), [])

  const value = useMemo(
    () => ({ adults, setAdults, inc, dec, min: MIN, max: MAX }),
    [adults, inc, dec]
  )

  return <PassengersContext.Provider value={value}>{children}</PassengersContext.Provider>
}

export function usePassengers() {
  const ctx = useContext(PassengersContext)
  if (!ctx) throw new Error('usePassengers precisa estar dentro de <PassengersProvider>')
  return ctx
}

// Multiplica um preço unitário pelo número de adultos. Retorna null se inválido,
// para o formatBRL exibir o "—" padrão.
export function totalFor(unitPrice, adults) {
  if (unitPrice == null || Number.isNaN(unitPrice)) return unitPrice
  return unitPrice * adults
}
