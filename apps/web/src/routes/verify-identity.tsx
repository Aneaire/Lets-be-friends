import { createFileRoute } from '@tanstack/react-router'
import { IdentityVerificationPage, type IdentityIntent, type IdentityReturnTo } from '../components/IdentityVerificationFlow'

const returnPaths = new Set<IdentityReturnTo>(['/app', '/profile', '/onboarding', '/become-host'])

export const Route = createFileRoute('/verify-identity')({
  validateSearch: (search: Record<string, unknown>): { intent: IdentityIntent; returnTo: IdentityReturnTo } => ({
    intent: search.intent === 'host_application' ? 'host_application' : 'member',
    returnTo: typeof search.returnTo === 'string' && returnPaths.has(search.returnTo as IdentityReturnTo)
      ? search.returnTo as IdentityReturnTo
      : search.intent === 'host_application' ? '/become-host' : '/app',
  }),
  component: VerifyIdentityRoute,
})

function VerifyIdentityRoute() {
  const search = Route.useSearch()
  return <IdentityVerificationPage intent={search.intent} returnTo={search.returnTo} />
}
