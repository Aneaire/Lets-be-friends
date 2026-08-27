export type GoogleOAuthResult = {
  createdSessionId: string | null
  authSessionResult: { type: string } | null
  signIn?: { status: string | null } | null
  signUp?: { status: string | null } | null
}

export type GoogleOAuthNextStep =
  | 'activate_session'
  | 'cancelled'
  | 'additional_requirements'
  | 'incomplete'

export const GOOGLE_OAUTH_CALLBACK_PATH = 'auth/callback'
export const GOOGLE_OAUTH_REDIRECT_OPTIONS = {
  scheme: 'letsbefriends',
  path: GOOGLE_OAUTH_CALLBACK_PATH,
  isTripleSlashed: true,
} as const

export function normalizeGoogleOAuthCallbackPath(path: string) {
  const callback = path.match(/^letsbefriends:\/\/\/?auth\/callback([?#].*)?$/i)
  return callback ? `/${GOOGLE_OAUTH_CALLBACK_PATH}${callback[1] ?? ''}` : path
}

export function googleOAuthNextStep(result: GoogleOAuthResult): GoogleOAuthNextStep {
  if (result.createdSessionId) return 'activate_session'
  if (result.authSessionResult && result.authSessionResult.type !== 'success') return 'cancelled'
  if (result.signIn?.status || result.signUp?.status) return 'additional_requirements'
  return 'incomplete'
}
