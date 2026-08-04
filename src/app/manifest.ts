import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Oringe Waswa & Akude Advocates',
    short_name: 'OWA Advocates',
    description: 'Legal services, client matters, appointments, and firm updates.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f5f5',
    theme_color: '#242e34',
    orientation: 'portrait-primary',
    // Next's manifest type only accepts one purpose value per entry (the
    // web manifest spec itself allows the space-separated "any maskable"
    // shorthand, Next's TS type doesn't), so 'any' and 'maskable' are
    // separate entries. PNG sizes listed first: some Android launchers and
    // older WebViews pick the first matching icon rather than preferring
    // the SVG, the raster fallback keeps the install icon correct there.
    // The maskable entries reuse the same flat (unpadded) source art for
    // now -- a maskable icon ideally has its own safe-zone padding so
    // Android's mask shapes don't clip the logo at the edges, worth a
    // dedicated asset later.
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
