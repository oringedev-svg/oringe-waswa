import ClientAccounts from '@/components/admin/ClientAccounts'

// The Clients domain home IS the account console, clients are managed as
// accounts, not as a menu of tools. The domain's tools stay one click away
// in the unfolded sidebar.
export default function Page() {
  return <ClientAccounts />
}
