export type AuthErrorContext = 'sign_in' | 'sign_up' | 'verification'

const invalidCredentials = new Set([
  'form_identifier_not_found',
  'form_password_incorrect',
  'form_param_format_invalid',
  'strategy_for_user_invalid',
])

const passwordPolicyRejected = new Set([
  'form_password_length_too_short',
  'form_password_not_strong_enough',
])

const invalidCode = new Set([
  'form_code_incorrect',
  'verification_failed',
])

export function safeAuthErrorMessage(error: unknown, context: AuthErrorContext): string {
  const codes = collectErrorCodes(error)

  if (codes.some((code) => invalidCredentials.has(code))) return 'Email or password is incorrect.'
  if (codes.includes('form_identifier_exists')) return 'An account already uses this email. Try signing in.'
  if (codes.includes('form_password_pwned')) return 'Choose a password that has not appeared in a known data breach.'
  if (codes.includes('form_password_size_in_bytes_exceeded')) return 'Choose a shorter password and try again.'
  if (codes.some((code) => passwordPolicyRejected.has(code))) return 'Your password does not meet the account security requirements.'
  if (codes.some((code) => invalidCode.has(code))) return 'That verification code is incorrect.'
  if (codes.some((code) => code.includes('expired'))) return 'That verification code has expired. Request a new code.'
  if (codes.includes('session_exists')) return 'You are already signed in.'
  if (codes.some((code) => code.includes('rate_limit') || code.includes('too_many'))) {
    return 'Too many attempts. Wait a moment and try again.'
  }

  if (context === 'verification') return 'Verification could not be completed. Please try again.'
  if (context === 'sign_up') return 'Your account could not be created. Check your details and try again.'
  return 'Sign in could not be completed. Check your connection and try again.'
}

function collectErrorCodes(value: unknown, seen = new WeakSet<object>()): string[] {
  if (!value || typeof value !== 'object' || seen.has(value)) return []
  seen.add(value)

  const record = value as Record<string, unknown>
  const codes: string[] = []
  if (typeof record.code === 'string') codes.push(record.code)
  if (Array.isArray(record.errors)) {
    for (const nested of record.errors) codes.push(...collectErrorCodes(nested, seen))
  }
  if (record.cause) codes.push(...collectErrorCodes(record.cause, seen))
  return codes
}
