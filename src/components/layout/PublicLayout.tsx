import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AIChatWidget from '@/components/chat/AIChatWidget'
import ScrollRevealProvider from '@/components/layout/ScrollRevealProvider'
import { SiteSettingsProvider } from '@/components/providers/SiteSettingsProvider'
import PageViewTracker from '@/components/layout/PageViewTracker'
import TranslatePersistence from '@/components/layout/TranslatePersistence'
import HelpWidget from '@/components/help/HelpWidget'

export default function PublicLayout({ children, fullBleedTop = false }: { children: React.ReactNode; fullBleedTop?: boolean }) {
  return (
    <SiteSettingsProvider>
      <ScrollRevealProvider>
        <div className="exec-ground flex flex-col min-h-screen">
          <PageViewTracker />
          <TranslatePersistence />
          <Navbar />
          <main className={fullBleedTop ? 'flex-1' : 'flex-1 pt-16 md:pt-20'}>
            {children}
          </main>
          <Footer />
          <AIChatWidget />
          <HelpWidget position="bottom-left" />
        </div>
      </ScrollRevealProvider>
    </SiteSettingsProvider>
  )
}
