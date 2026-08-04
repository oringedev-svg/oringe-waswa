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
    // shorthand, Next's TS type doesn't), so 'any' and 'maskable' are two
    // entries. Both point at the same source icon for now; a maskable icon
    // ideally has extra safe-zone padding of its own so Android's mask
    // shapes don't clip the logo, worth a dedicated asset later.
    icons: [
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
