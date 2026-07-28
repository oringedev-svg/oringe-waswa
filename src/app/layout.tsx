import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'Oringe Waswa & Akude Advocates LLP', template: '%s | Oringe Waswa & Akude Advocates LLP' },
  description: 'Leading law firm in Kenya, Justice, Integrity, Excellence.',
  keywords: ['law firm', 'Kenya', 'Nairobi', 'legal services', 'advocates'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        {/* Tells Chrome's own built-in page translator, and Google Translate
            generally, to leave this page's DOM alone. Live translation is
            handled deliberately by TranslateWidget on public pages only,
            an uncontrolled translator rewriting text nodes behind React's
            back is what causes "NotFoundError: insertBefore" crashes the
            moment a re-render happens (e.g. after any data refetch). */}
        <meta name="google" content="notranslate" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
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
