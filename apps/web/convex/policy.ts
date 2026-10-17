import { ConvexError } from 'convex/values'
import { currentPolicyVersion, hasCurrentUnifiedAcceptance } from '@lets-be-friends/shared'

export { currentPolicyVersion }

export function requireUnifiedAcceptance(viewer: {
  approximateLocationConsentedAt?: number
  termsAcceptedAt?: number
  termsVersion?: string
  privacyPolicyAcceptedAt?: number
  privacyPolicyVersion?: string
  identityConsentAcceptedAt?: number
  identityConsentVersion?: string
  suspended?: boolean
}) {
  if (viewer.suspended) throw new ConvexError('Account is suspended')
  if (!viewer.approximateLocationConsentedAt) {
    throw new ConvexError('Approximate location consent is required. Complete the welcome guide Step 5 acceptance first')
  }
  if (!hasCurrentUnifiedAcceptance(viewer)) {
    throw new ConvexError('Current Terms, Privacy Policy, and identity processing acceptance is required. Complete the welcome guide Step 5 acceptance first')
  }
  return {
    policyVersion: currentPolicyVersion,
    // The identity scope timestamp authorizes identity operations. It is the
    // persisted Step 5 acceptance, never a fresh consent per operation.
    acceptedAt: viewer.identityConsentAcceptedAt as number,
  }
}
