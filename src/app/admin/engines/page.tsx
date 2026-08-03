import { Cpu } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/admin/ui'

export default function EnginesPage() {
  return <div><PageHeader icon={Cpu} eyebrow="Automation" title="Engines" meta={['0 suites configured']} /><EmptyState icon={Cpu} title="No engine suites configured" description="This space is ready for the engine suites you will define next." /></div>
}
