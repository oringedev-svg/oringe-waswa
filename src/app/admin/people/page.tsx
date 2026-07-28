import { redirect } from 'next/navigation'

// The client list now lives in the Client Directory (the Clients domain
// home), which shows pre-accounts and accounts together. Account detail
// pages remain at /admin/people/[id].
export default function Page() {
  redirect('/admin/clients')
}
