import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import PwaRegistration from '@/components/layout/PwaRegistration'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'Oringe Waswa & Akude Advocates LLP', template: '%s | Oringe Waswa & Akude Advocates LLP' },
  description: 'Leading law firm in Kenya, Justice, Integrity, Excellence.',
  keywords: ['law firm', 'Kenya', 'Nairobi', 'legal services', 'advocates'],
  manifest: '/manifest.webmanifest',
  icons: { icon: '/app-icon.svg', apple: '/app-icon.svg' },
  appleWebApp: { capable: true, title: 'OWA Advocates', statusBarStyle: 'default' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        {/* Deliberately NOT setting `translate="no"` or a `notranslate` meta
            tag here — that would block TranslateWidget (Navbar/Footer) from
            translating the public site at all, which is the actual point of
            this file. The DOM-conflict risk that motivated blocking
            translation site-wide (Google's widget rewriting text nodes
            behind React's back, causing "NotFoundError: insertBefore" on a
            re-render) is scoped instead to just the admin portal, in
            src/app/admin/layout.tsx, where live data refetches are frequent
            and translation was never wanted in the first place. */}
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <PwaRegistration />
          {children}
          <Toaster position="top-right" toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '0.875rem',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
            },
          }} />
        </ThemeProvider>
      </body>
    </html>
  )
}
