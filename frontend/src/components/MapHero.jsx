import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useNavigate } from 'react-router-dom'
import { greatCircle, bounds } from '../lib/geo'
import { dropTone } from '../lib/utils'
import './MapHero.css'

// Estilo dark gratuito do OpenFreeMap — sem API key, sem conta, sem cartão.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark'

// Sequência de dasharrays para o efeito de "fluxo" correndo pelo arco.
const DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
  [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5],
  [0, 3, 3, 1], [0, 3.5, 3, 0.5],
]

export default function MapHero({ origin, deals = [], onReady }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!origin || !containerRef.current || mapRef.current) return

    const pts = deals.filter((d) => d.lat != null && d.lon != null)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [origin.lon, origin.lat],
      zoom: 2.4,
      attributionControl: false,
      pitch: 0,
    })
    mapRef.current = map

    // O mapa é criado dentro do useEffect enquanto a página ainda está em
    // transição (framer-motion) — o container pode reportar tamanho 0 no
    // primeiro frame, o que deixa o canvas WebGL preto. Forçar resize após o
    // layout estabilizar garante que ele preencha o container.
    const resize = () => map.resize()
    const ro = new ResizeObserver(resize)
    ro.observe(containerRef.current)
    const rafResize = requestAnimationFrame(resize)

    map.on('load', () => {
      map.resize()
      // ---- Arcos (great circle) como uma única fonte GeoJSON ----
      const features = pts.map((d) => ({
        type: 'Feature',
        properties: { tone: dropTone(d.queda_pct) },
        geometry: {
          type: 'LineString',
          coordinates: greatCircle([origin.lon, origin.lat], [d.lon, d.lat]),
        },
      }))
      map.addSource('arcs', { type: 'geojson', data: { type: 'FeatureCollection', features } })

      map.addLayer({
        id: 'arcs-glow',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#00D4AA',
          'line-width': 3.4,
          'line-opacity': 0.12,
          'line-blur': 3,
        },
      })
      map.addLayer({
        id: 'arcs-flow',
        type: 'line',
        source: 'arcs',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#00F0C0',
          'line-width': 1.6,
          'line-opacity': 0.9,
        },
      })

      // Animação do "fluxo" via dasharray. Os ids de rAF/timeout ficam no map
      // para serem cancelados no cleanup — senão o callback agendado dispara
      // depois de map.remove() e quebra em map.getLayer (style já undefined).
      let step = 0
      const animate = () => {
        if (mapRef.current !== map || !map.getLayer('arcs-flow')) return
        step = (step + 1) % DASH_SEQ.length
        map.setPaintProperty('arcs-flow', 'line-dasharray', DASH_SEQ[step])
        map._dashTimer = setTimeout(() => {
          map._dashRAF = requestAnimationFrame(animate)
        }, 60)
      }
      animate()

      // ---- Origem (Rio) ----
      addMarker(map, origin.lon, origin.lat, 'origin-pin', null)

      // ---- Destinos ----
      pts.forEach((d) => {
        const tone = dropTone(d.queda_pct)
        const el = addMarker(map, d.lon, d.lat, `dest-pin tone-${tone}`, d)
        el.addEventListener('click', () => navigate(`/deal/${d.destino}`))
      })

      // Enquadra todos os pontos.
      const b = bounds([[origin.lon, origin.lat], ...pts.map((d) => [d.lon, d.lat])])
      if (b) {
        map.fitBounds(b, { padding: 56, duration: 1400, maxZoom: 4.2 })
      }

      onReady && onReady()
    })

    return () => {
      cancelAnimationFrame(rafResize)
      ro.disconnect()
      if (map._dashRAF) cancelAnimationFrame(map._dashRAF)
      if (map._dashTimer) clearTimeout(map._dashTimer)
      map.remove()
      mapRef.current = null
    }
  }, [origin, deals, navigate, onReady])

  return (
    <div className="map-hero">
      <div ref={containerRef} className="map-canvas" />
      <div className="map-vignette" />
      <div className="map-origin-label glass">✈️ {origin?.name || 'Rio de Janeiro'}</div>
    </div>
  )
}

function addMarker(map, lon, lat, className, deal) {
  const el = document.createElement('div')
  el.className = `pin ${className}`
  if (deal) {
    const ring = document.createElement('span'); ring.className = 'pin-ring'
    const dot = document.createElement('span'); dot.className = 'pin-dot'
    el.appendChild(ring); el.appendChild(dot)
    el.title = `${deal.cidade} · R$ ${Math.round(deal.preco_brl)}`
  } else {
    el.innerHTML = '<span class="pin-origin-core"></span><span class="pin-origin-ring"></span>'
  }
  new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map)
  return el
}
