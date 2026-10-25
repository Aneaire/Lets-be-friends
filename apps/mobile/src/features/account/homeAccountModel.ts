import {
  accountIdentityKey,
  buildAccountSheetItems,
  resolveAccountAvatarAction,
} from './accountSheet'

export type HomeAccountApplication = {
  _id: string
  status?: string | null
} | null

/**
 * Pure model behind the Home header account controls. Guests get the sign-in
 * action and no sheet; a signed-out or unconfigured backend never touches
 * Clerk account state. The identity key scopes sheet, busy, and error state
 * to one account so a stale account never owns the UI.
 */
export function homeAccountModel(input: {
  signedIn: boolean
  authStatus: string
  clerkUserId?: string | null
  displayName?: string
  authDisplayName?: string
  profileImageUrl?: string | null
  email?: string
  role?: string
  identityEligible: boolean
  application?: HomeAccountApplication | undefined
}) {
  const avatarAction = resolveAccountAvatarAction(input.signedIn)
  const identityKey = accountIdentityKey({ status: input.authStatus, clerkUserId: input.clerkUserId })
  if (!input.signedIn) {
    return {
      avatarAction,
      accountName: input.authDisplayName,
      accountImage: undefined as string | undefined,
      accountEmail: undefined as string | undefined,
      identityKey,
      items: [],
      fullyVerified: false,
    }
  }
  const application = input.application ?? null
  const fullyVerified =
    input.identityEligible && Boolean(application) && application?.status !== 'draft'
  return {
    avatarAction,
    accountName: input.displayName,
    accountImage: input.profileImageUrl ?? undefined,
    accountEmail: input.email,
    identityKey,
    items: buildAccountSheetItems({
      applicationStatus: application?.status ?? null,
      applicationId: application ? String(application._id) : null,
      identityEligible: input.identityEligible,
      hasCompanionContext: input.role === 'companion' || Boolean(application),
    }),
    fullyVerified,
  }
}
