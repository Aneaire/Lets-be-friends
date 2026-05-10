import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'

const convexUrl = import.meta.env.VITE_CONVEX_URL

if (!convexUrl) {
  throw new Error('Missing VITE_CONVEX_URL. Add it to .env.local or alias CONVEX_URL to VITE_CONVEX_URL.')
}

const convex = new ConvexReactClient(convexUrl)
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const clerkAppearance = {
  variables: {
    borderRadius: '10px',
    colorBackground: 'var(--surface)',
    colorDanger: 'var(--danger)',
    colorInputBackground: 'var(--surface)',
    colorInputText: 'var(--text)',
    colorNeutral: 'var(--surface-sunk)',
    colorPrimary: 'var(--accent-self)',
    colorText: 'var(--text)',
    colorTextOnPrimaryBackground: 'oklch(99% 0 0)',
    colorTextSecondary: 'var(--text-muted)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: {
      normal: 450,
      medium: 550,
      bold: 650,
    },
  },
  elements: {
    modalBackdrop: {
      backgroundColor: 'color-mix(in oklch, var(--text) 24%, transparent)',
      backdropFilter: 'blur(2px)',
    },
    modalContent: {
      borderRadius: '14px',
      border: '1px solid var(--rule)',
    },
    cardBox: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--rule)',
      borderRadius: '14px',
      overflow: 'hidden',
    },
    card: {
      backgroundColor: 'var(--surface)',
      color: 'var(--text)',
      borderRadius: '14px 14px 0 0',
      boxShadow: 'none',
    },
    headerTitle: {
      color: 'var(--text)',
      fontSize: '1.25rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    headerSubtitle: {
      color: 'var(--text-muted)',
      fontSize: '0.9rem',
    },
    socialButtonsBlockButton: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      color: 'var(--text)',
      borderRadius: '8px',
      fontWeight: 500,
    },
    socialButtonsBlockButtonText: {
      color: 'var(--text)',
      fontWeight: 500,
    },
    dividerLine: {
      backgroundColor: 'var(--rule)',
    },
    dividerText: {
      color: 'var(--text-soft)',
      fontWeight: 500,
    },
    formFieldLabel: {
      color: 'var(--text)',
      fontWeight: 600,
      fontSize: '0.8125rem',
    },
    formFieldInput: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      color: 'var(--text)',
      boxShadow: 'none',
    },
    formFieldInputShowPasswordButton: {
      color: 'var(--text-muted)',
    },
    formButtonPrimary: {
      backgroundColor: 'var(--accent-self)',
      borderRadius: '8px',
      color: 'oklch(99% 0 0)',
      fontWeight: 500,
      minHeight: '2.25rem',
      boxShadow: 'none',
    },
    footer: {
      backgroundColor: 'var(--surface)',
      borderRadius: '0 0 14px 14px',
      borderTop: '0',
      boxShadow: 'none',
      color: 'var(--text-muted)',
      marginTop: '0',
    },
    footerAction: {
      backgroundColor: 'var(--surface)',
      borderRadius: '0',
      borderTop: '0',
      boxShadow: 'none',
      marginTop: '0',
    },
    footerActionText: {
      color: 'var(--text-muted)',
    },
    footerActionLink: {
      color: 'var(--accent-self)',
      fontWeight: 600,
    },
    footerPages: {
      backgroundColor: 'var(--surface)',
      borderRadius: '0',
      borderTop: '0',
      boxShadow: 'none',
      marginTop: '0',
    },
    identityPreview: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
    },
    identityPreviewText: {
      color: 'var(--text)',
    },
    identityPreviewEditButton: {
      color: 'var(--accent-self)',
    },
    alternativeMethodsBlockButton: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      color: 'var(--text)',
    },
    otpCodeFieldInput: {
      backgroundColor: 'var(--surface)',
      borderColor: 'var(--border)',
      color: 'var(--text)',
    },
    formFieldAction: {
      color: 'var(--accent-self)',
      fontWeight: 600,
    },
    alertText: {
      color: 'var(--danger)',
    },
    userButtonPopoverCard: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--rule)',
      borderRadius: '12px',
    },
    userButtonPopoverActionButton: {
      color: 'var(--text)',
    },
    userButtonPopoverActionButtonText: {
      color: 'var(--text)',
    },
  },
} as const

const clerkLocalization = {
  signIn: {
    start: {
      title: "Sign in to Let's Be Friends",
      subtitle: 'Continue to your profile, bookings, and Friend Host tools.',
      actionText: 'New to Let\'s Be Friends?',
      actionLink: 'Create an account',
    },
  },
  signUp: {
    start: {
      title: "Create your Let's Be Friends account",
      subtitle: 'Join with a basic profile first. Verification only starts when booking or applying as a Friend Host.',
      actionText: 'Already have an account?',
      actionLink: 'Sign in',
    },
  },
  socialButtonsBlockButton: 'Continue with {{provider|titleize}}',
  dividerText: 'or',
  formButtonPrimary: 'Continue',
  formFieldLabel__emailAddress: 'Email address',
  formFieldInputPlaceholder__emailAddress: 'Enter your email address',
} as const

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      publishableKey={clerkPublishableKey}
      localization={clerkLocalization}
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
