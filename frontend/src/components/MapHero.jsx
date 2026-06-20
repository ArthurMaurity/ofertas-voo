import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { useNavigate } from 'react-router-dom'
import { greatCircle, bounds } from '../lib/geo'
import { dropTone } from '../lib/utils'
import './MapHero.css'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

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
  const [missingToken] = useState(!TOKEN || TOKEN.includes('COLE_SEU'))

  useEffect(() => {
    if (missingToken || !origin || !containerRef.current || mapRef.current) return

    mapboxgl.accessToken = TOKEN
    const pts = deals.filter((d) => d.lat != null && d.lon != null)

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [origin.lon, origin.lat],
      zoom: 2.4,
      attributionControl: false,
      projection: 'globe',
      pitch: 0,
    })
    mapRef.current = map

    map.on('style.load', () => {
      map.setFog({
        color: 'rgb(10,15,30)',
        'high-color': 'rgb(14,21,40)',
        'horizon-blend': 0.2,
        'space-color': 'rgb(6,9,18)',
        'star-intensity': 0.45,
      })
    })

    map.on('load', () => {
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

      // Animação do "fluxo" via dasharray.
      let step = 0
      const animate = () => {
        step = (step + 1) % DASH_SEQ.length
        if (map.getLayer('arcs-flow')) {
          map.setPaintProperty('arcs-flow', 'line-dasharray', DASH_SEQ[step])
        }
        mapRef.current && (mapRef.current._dashRAF = requestAnimationFrame(() => {
          setTimeout(animate, 60)
        }))
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
      if (map._dashRAF) cancelAnimationFrame(map._dashRAF)
      map.remove()
      mapRef.current = null
    }
  }, [origin, deals, missingToken, navigate, onReady])

  if (missingToken) {
    return (
      <div className="map-hero map-fallback">
        <div className="map-fallback-inner">
          <div className="map-fallback-emoji">🗺️</div>
          <p><strong>Mapa indisponível</strong></p>
          <p className="muted">Configure <code>VITE_MAPBOX_TOKEN</code> no arquivo
            <code> .env</code> para ver os arcos animados saindo do Rio.</p>
        </div>
      </div>
    )
  }

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
  new mapboxgl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map)
  return el
}
