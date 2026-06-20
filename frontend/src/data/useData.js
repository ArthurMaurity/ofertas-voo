import { useEffect, useState } from 'react'

// Os JSONs são servidos a partir de <base>/data/. Em dev, o Vite serve a pasta
// public/ na raiz; o workflow de deploy copia data/ -> public/data/ antes do build.
const DATA_BASE = `${import.meta.env.BASE_URL}data/`

async function fetchJson(name) {
  const res = await fetch(`${DATA_BASE}${name}?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Falha ao carregar ${name} (${res.status})`)
  return res.json()
}

function useJson(name) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    let alive = true
    fetchJson(name)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }))
    return () => { alive = false }
  }, [name])
  return state
}

export function useDeals() {
  const { data, loading, error } = useJson('deals.json')
  return {
    loading,
    error,
    deals: data?.deals ?? [],
    origin: data?.origin ?? null,
    config: data?.config ?? null,
    generatedAt: data?.generated_at ?? null,
  }
}

export function useHistory() {
  const { data, loading, error } = useJson('history.json')
  return {
    loading,
    error,
    routes: data?.routes ?? {},
    origin: data?.origin ?? null,
    generatedAt: data?.generated_at ?? null,
  }
}
