import AdminLayout from '@/components/admin/AdminLayout'

export const metadata = {
  title: { default: 'Admin', template: '%s | Admin, Oringe Waswa' },
  // Admin pages refetch and re-render live data constantly. If Google
  // Translate has rewritten text nodes here, React's next re-render can
  // throw "NotFoundError: insertBefore" trying to reconcile against DOM
  // it no longer recognizes. The public site (root layout) intentionally
  // has no such tag, since TranslateWidget needs translation to actually
  // work there — this tag keeps that risk contained to just /admin.
  other: { google: 'notranslate' },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}