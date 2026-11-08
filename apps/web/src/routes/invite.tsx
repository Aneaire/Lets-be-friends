import { createFileRoute } from '@tanstack/react-router'
import { ReferralInvitation } from '../features/referral/ReferralInvitation'

export const Route = createFileRoute('/invite')({
  validateSearch: (search: Record<string, unknown>): { ref?: string } => ({ ref: typeof search.ref === 'string' ? search.ref : undefined }),
  component: InvitePage,
})

function InvitePage() {
  const { ref } = Route.useSearch()
  return <ReferralInvitation code={ref} />
}
