import { companionSetupState, verificationNudge } from '@/features/verification/verificationNudge'
import { companionIsPublic } from '@/member/profileSections'

export type AccountSheetRoute =
  | { pathname: '/profile' }
  | { pathname: '/get-verified' }
  | { pathname: '/companion-profile/[id]'; params: { id: string } }
  | { pathname: '/companion' }
  | { pathname: '/wallet' }
  | { pathname: '/settings' }
  | { pathname: '/safety' }
  | { pathname: '/auth' }

export type AccountSheetItemId =
  | 'verification'
  | 'profile'
  | 'public-profile'
  | 'companion'
  | 'wallet'
  | 'settings'
  | 'safety'

export type AccountSheetItem = {
  id: AccountSheetItemId
  label: string
  highlight?: boolean
  detail?: string
  icon: 'person-outline' | 'people-outline' | 'wallet-outline' | 'settings-outline' | 'shield-outline' | 'eye-outline'
  route: AccountSheetRoute
}

export function accountSheetRoutes(): Record<AccountSheetItemId, (args: { companionProfileId?: string }) => AccountSheetRoute> {
  return {
    verification: () => ({ pathname: '/get-verified' }),
    profile: () => ({ pathname: '/profile' }),
    'public-profile': (args) => ({ pathname: '/companion-profile/[id]', params: { id: String(args.companionProfileId ?? '') } }),
    companion: () => ({ pathname: '/companion' }),
    wallet: () => ({ pathname: '/wallet' }),
    settings: () => ({ pathname: '/settings' }),
    safety: () => ({ pathname: '/safety' }),
  }
}

export type AccountSheetInput = {
  applicationStatus?: string | null
  applicationId?: string | null
  identityEligible: boolean
  hasCompanionContext: boolean
}

/**
 * Builds Account navigation with a shared verification and earnings nudge.
 * The public Companion profile row appears only when the profile is actually
 * public: approved application plus current identity approval.
 */
export function buildAccountSheetItems(input: AccountSheetInput): AccountSheetItem[] {
  const routes = accountSheetRoutes()
  const nudge = verificationNudge({ state: input.identityEligible ? 'approved' : 'not_started' }, companionSetupState(input.applicationStatus))
  const items: AccountSheetItem[] = [
    { id: 'profile', label: 'Profile', detail: 'Name, photo, bio, posts, and reviews', icon: 'person-outline', route: routes.profile({}) },
  ]
  items.push({ id: 'verification', label: nudge.highlight ? nudge.label : 'Verification', highlight: nudge.highlight, detail: 'Identity check and Companion profile progress', icon: 'shield-outline', route: nudge.label === 'Unlock earnings' ? routes.companion({}) : routes.verification({}) })
  if (companionIsPublic(input.applicationStatus ?? null, input.identityEligible) && input.applicationId) {
    items.push({
      id: 'public-profile',
      label: 'View public Companion profile',
      detail: 'What members read about your Companion profile',
      icon: 'eye-outline',
      route: routes['public-profile']({ companionProfileId: input.applicationId }),
    })
  }
  items.push({
    id: 'companion',
    label: input.hasCompanionContext ? 'Companion tools' : 'Become a Companion',
    detail: input.hasCompanionContext ? 'Offer, availability, rate, and requests' : 'Share everyday Strengths and earn on your terms',
    icon: 'people-outline',
    route: routes.companion({}),
  })
  items.push({ id: 'wallet', label: 'Wallet', detail: 'Available balance and top-ups', icon: 'wallet-outline', route: routes.wallet({}) })
  items.push({ id: 'settings', label: 'Settings', detail: 'Notifications, appearance, and account', icon: 'settings-outline', route: routes.settings({}) })
  items.push({ id: 'safety', label: 'Safety and help', detail: 'Meeting guidance, reports, and blocks', icon: 'shield-outline', route: routes.safety({}) })
  return items
}

/**
 * Decides what the Home header avatar does. Guests sign in; only a signed-in
 * member with loaded account state opens the Account sheet.
 */
export function resolveAccountAvatarAction(signedIn: boolean): 'open_sheet' | 'sign_in' {
  return signedIn ? 'open_sheet' : 'sign_in'
}

/**
 * Stable key for the signed-in account. Screens reset sheet, busy, and error
 * state when this key changes so a stale account never owns the UI.
 */
export function accountIdentityKey(input: { status: string; clerkUserId?: string | null }): string {
  if (input.status === 'signed_in') return `signed_in:${input.clerkUserId ?? 'unknown'}`
  return input.status
}

/**
 * Sheet selection closes the sheet before routing so the overlay is gone
 * before the next screen mounts.
 */
export function selectAccountSheetItem(
  item: AccountSheetItem,
  controls: { close: () => void; navigate: (route: AccountSheetRoute) => void },
): void {
  controls.close()
  controls.navigate(item.route)
}

export type AccountSignOutSession = {
  accountId: string
  generation: number
  flightId: symbol
}

export type AccountSignOutCoordinator = {
  begin: (session: AccountSignOutSession) => boolean
  finish: (session: AccountSignOutSession) => void
  cancel: () => void
  isBusy: () => boolean
}

/**
 * Synchronous in-flight guard shared by every Account sheet and the Settings
 * sign-out row. begin() returns false for duplicate taps in the same tick.
 * finish() clears only the exact flight that began, so even a newer flight for
 * the same account cannot be reset by an older completion.
 */
export function createAccountSignOutCoordinator(): AccountSignOutCoordinator {
  let inFlight: AccountSignOutSession | null = null
  return {
    begin: (session) => {
      if (inFlight !== null) return false
      inFlight = session
      return true
    },
    finish: (session) => {
      if (inFlight === session) inFlight = null
    },
    cancel: () => {
      inFlight = null
    },
    isBusy: () => inFlight !== null,
  }
}

export type AccountSignOutOutcome = 'signed_out' | 'duplicate' | 'failed' | 'stale'

/**
 * Runs the real auth cleanup exactly once per flight. A second same-tick tap
 * returns 'duplicate' without touching auth. Failure clears the flight so the
 * member can retry. When the account changed mid-flight the result is 'stale'
 * and callers must not apply signed-out UI to the new account.
 */
export async function runAccountSignOut(input: {
  session: AccountSignOutSession
  coordinator: AccountSignOutCoordinator
  isCurrent: (session: AccountSignOutSession) => boolean
  signOut: (() => Promise<void>) | null
}): Promise<AccountSignOutOutcome> {
  if (!input.isCurrent(input.session) || input.signOut === null) return 'stale'
  if (!input.coordinator.begin(input.session)) return 'duplicate'
  try {
    await input.signOut()
  } catch {
    const outcome = input.isCurrent(input.session) ? 'failed' : 'stale'
    input.coordinator.finish(input.session)
    return outcome
  }
  const outcome = input.isCurrent(input.session) ? 'signed_out' : 'stale'
  input.coordinator.finish(input.session)
  return outcome
}
