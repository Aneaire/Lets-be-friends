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

export function googleOAuthNextStep(result: GoogleOAuthResult): GoogleOAuthNextStep {
  if (result.createdSessionId) return 'activate_session'
  if (result.authSessionResult && result.authSessionResult.type !== 'success') return 'cancelled'
  if (result.signIn?.status || result.signUp?.status) return 'additional_requirements'
  return 'incomplete'
}
