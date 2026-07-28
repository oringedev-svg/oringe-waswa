import AdminLayout from '@/components/admin/AdminLayout'

export const metadata = { title: { default: 'Admin', template: '%s | Admin, Oringe Waswa' } }

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}
