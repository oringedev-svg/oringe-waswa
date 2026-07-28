'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { DivIcon } from 'leaflet'
// Never imported anywhere before, without it every Leaflet control (zoom
// buttons, popup box, attribution corner) rendered as unstyled raw HTML.
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })

interface Area {
  id: string
  name: string
  region: string
  country: string
  latitude: number
  longitude: number
  description?: string
  services: string[]
}

// A small numbered pin echoing the sidebar's own "01/02/03" badges, instead
// of Leaflet's default blue teardrop marker (which also needs image assets
// that are easy to lose in a Next.js build). Built client-side only.
function useNumberedIcons(count: number) {
  const [icons, setIcons] = useState<DivIcon[]>([])
  useEffect(() => {
    if (count === 0) return
    import('leaflet').then(({ divIcon }) => {
      const built = Array.from({ length: count }, (_, i) =>
        divIcon({
          className: 'map-pin',
          html: `<span>${String(i + 1).padStart(2, '0')}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -15],
        })
      )
      setIcons(built)
    })
  }, [count])
  return icons
}

// No client-side fetch here any more, coverage areas arrive server-fetched
// from the homepage; the map itself still has to be client-only (Leaflet
// touches window/document directly).
export default function CoverageMap({ initialAreas }: { initialAreas: Area[] }) {
  const areas = initialAreas
  const icons = useNumberedIcons(areas.length)

  const center: [number, number] = areas.length
    ? [areas.reduce((s, a) => s + a.latitude, 0) / areas.length, areas.reduce((s, a) => s + a.longitude, 0) / areas.length]
    : [-1.286389, 36.817223]

  return (
    <section className="section" style={{ background: 'var(--color-surface)' }}>
      <div className="container">
        <div className="text-center mb-14 reveal">
          <h2 className="font-display" style={{ fontSize: 'var(--heading-section-size)', fontWeight: 300 }}>Where We Practice</h2>
          <p className="mt-4 text-[var(--color-text-muted)] max-w-xl mx-auto">
            Grounded locally, with the reach to represent you wherever your matter takes us.
          </p>
        </div>

        {/* One centred map, no sidebar list. The list duplicated what the
            pins already say and pushed the map off-centre; details now
            live in the pin's own popup. A pulsing ring on the pins hints
            that they are clickable, since a static marker reads as
            decoration to plenty of people. */}
        <div className="coverage-map-wrap">
          <div className="coverage-map-frame reveal">
            <MapContainer
              center={center}
              zoom={areas.length > 1 ? 7 : 14}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                className="coverage-map-tiles"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {icons.length === areas.length && areas.map((area, i) => (
                <Marker
                  key={area.id}
                  position={[area.latitude, area.longitude]}
                  icon={icons[i]}
                >
                  <Popup>
                    <div className="coverage-map-popup">
                      <strong>{area.name}</strong>
                      <div className="coverage-map-popup-region">{area.region}, {area.country}</div>
                      {area.description && <div className="coverage-map-popup-desc">{area.description}</div>}
                      {area.services?.length > 0 && (
                        <div className="coverage-map-popup-services">
                          {area.services.slice(0, 3).join(' · ')}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {areas.length === 0 && (
            <p className="text-[var(--color-muted)] text-sm text-center py-8">No coverage areas listed yet.</p>
          )}
        </div>

        {/* Says out loud what the pulsing pin only implies. */}
        {areas.length > 0 && (
          <p className="coverage-map-hint reveal">
            <span className="coverage-map-hint-dot" aria-hidden="true" />
            Select a location to see what we handle there
          </p>
        )}

        <div className="text-center mt-8 reveal">
          <Link href="/appointments" className="btn btn-primary text-sm">Book a Consultation</Link>
        </div>
      </div>
    </section>
  )
}
