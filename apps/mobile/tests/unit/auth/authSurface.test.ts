import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const authSource = readFileSync(join(process.cwd(), 'src/app/auth.tsx'), 'utf8')

describe('native account surface', () => {
  it('uses the Google OAuth strategy that production Clerk enables', () => {
    expect(authSource).toContain("strategy: 'oauth_google'")
    expect(authSource).toContain('<ActionButton')
    expect(authSource).toContain('Continue with Google')
  })

  it('lets the action carry the screen instead of restating it in copy', () => {
    expect(authSource).toContain('We never ask for a password.')
    expect(authSource).not.toContain('Sign in with Google.')
    expect(authSource).not.toContain('New members join in the same step.')
  })

  it('centers one group with the brand and tagline above the action', () => {
    expect(authSource).toContain('<AuthFrame>')
    expect(authSource).toContain('<Brand size="lg" layout="stacked" />')
    expect(authSource).toContain('{BRAND_TAGLINE}')
    expect(authSource).toContain("alignItems: 'center'")
    expect(authSource).toContain("justifyContent: 'center'")
    expect(authSource).toContain("textAlign: 'center'")
  })

  it('keeps a heading role for the account states that still carry copy', () => {
    expect(authSource).toContain('accessibilityRole="header"')
  })

  it('does not offer email, password, recovery, or a separate sign-up mode', () => {
    expect(authSource).not.toContain('TextInput')
    expect(authSource).not.toContain('secureTextEntry')
    expect(authSource).not.toContain('Forgot password')
    expect(authSource).not.toContain('Create account')
    expect(authSource).not.toContain("'sign_up'")
    expect(authSource).not.toContain('useSignIn')
    expect(authSource).not.toContain('useSignUp')
    expect(authSource).not.toContain('resetPassword')
    expect(authSource).not.toContain('verifications.')
  })
})
