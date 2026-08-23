import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import type { ReactNode } from 'react'

const convexUrl = import.meta.env.VITE_CONVEX_URL
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!convexUrl) {
  throw new Error('Missing VITE_CONVEX_URL. Add it to .env.local or apps/admin/.env.local.')
}

const convex = new ConvexReactClient(convexUrl)

const clerkAppearance = {
  variables: {
    borderRadius: '10px',
    colorBackground: 'var(--surface)',
    colorDanger: 'var(--danger)',
    colorInputBackground: 'var(--surface)',
    colorInputText: 'var(--text)',
    colorNeutral: 'var(--surface-sunk)',
    colorPrimary: 'var(--text)',
    colorText: 'var(--text)',
    colorTextOnPrimaryBackground: 'var(--surface)',
    colorTextSecondary: 'var(--text-muted)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  elements: {
    modalBackdrop: {
      backgroundColor: 'color-mix(in oklch, var(--text) 24%, transparent)',
      backdropFilter: 'blur(2px)',
    },
    cardBox: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--rule)',
      borderRadius: '14px',
      boxShadow: 'none',
      overflow: 'hidden',
    },
    card: {
      backgroundColor: 'var(--surface)',
      boxShadow: 'none',
    },
    formButtonPrimary: {
      backgroundColor: 'var(--text)',
      color: 'var(--surface)',
      borderRadius: '8px',
      boxShadow: 'none',
      fontWeight: 550,
    },
    formFieldInput: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      color: 'var(--text)',
      boxShadow: 'none',
    },
    headerTitle: {
      color: 'var(--text)',
      fontWeight: 650,
    },
    headerSubtitle: {
      color: 'var(--text-muted)',
    },
  },
} as const

const clerkLocalization = {
  signIn: {
    start: {
      title: "Sign in to Let's Be Friends Admin",
      subtitle: 'Continue to safety review, moderation, and platform operations.',
    },
  },
  formButtonPrimary: 'Continue',
  formFieldLabel__emailAddress: 'Email address',
  formFieldInputPlaceholder__emailAddress: 'Enter your email address',
} as const

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      publishableKey={clerkPublishableKey}
      localization={clerkLocalization}
      signInFallbackRedirectUrl="/overview"
      signUpFallbackRedirectUrl="/overview"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
