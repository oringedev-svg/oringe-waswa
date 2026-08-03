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
    icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  }
}
