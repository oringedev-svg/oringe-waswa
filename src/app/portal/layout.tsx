import PortalLayout from '@/components/portal/PortalLayout'

export const metadata = {
  title: { default: 'Portal', template: '%s | Portal, Oringe Waswa' },
}

export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayout>{children}</PortalLayout>
}
