import { redirect } from 'next/navigation'

// Postings and applications both moved into the Recruitment pipeline
// (/admin/recruitment), which replaces this page's old Openings +
// Applications tabs with the full acef-style stage pipeline, notes,
// interview scheduling, onboarding, and certification.
export default function Page() {
  redirect('/admin/recruitment')
}
