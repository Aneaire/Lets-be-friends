import { createFileRoute } from '@tanstack/react-router'
import { IdentityVerificationPage, type IdentityIntent, type IdentityReturnTo } from '../components/IdentityVerificationFlow'

const returnPaths = new Set<IdentityReturnTo>(['/app', '/profile', '/onboarding', '/become-companion'])
type MobileReturnTo = 'profile' | 'companion'

export const Route = createFileRoute('/verify-identity')({
  validateSearch: (search: Record<string, unknown>): { intent: IdentityIntent; returnTo: IdentityReturnTo; mobileReturn?: MobileReturnTo } => ({
    intent: search.intent === 'companion_application' ? 'companion_application' : 'member',
    returnTo: typeof search.returnTo === 'string' && returnPaths.has(search.returnTo as IdentityReturnTo)
      ? search.returnTo as IdentityReturnTo
      : search.intent === 'companion_application' ? '/become-companion' : '/app',
    mobileReturn: search.intent === 'companion_application' && search.mobileReturn === 'companion'
      ? 'companion'
      : search.intent !== 'companion_application' && search.mobileReturn === 'profile'
        ? 'profile'
        : undefined,
  }),
  component: VerifyIdentityRoute,
})

function VerifyIdentityRoute() {
  const search = Route.useSearch()
  return <IdentityVerificationPage intent={search.intent} returnTo={search.returnTo} mobileReturn={search.mobileReturn} />
}
