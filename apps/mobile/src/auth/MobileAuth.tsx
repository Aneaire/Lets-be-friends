import { useAuth, useClerk, useSession, useUser } from '@clerk/expo'
import { createContext, type PropsWithChildren, useContext, useMemo } from 'react'

export type MobileAuthState =
  | { status: 'demo'; clerkConfigured: false }
  | { status: 'setup_error'; clerkConfigured: false; message: string }
  | { status: 'loading'; clerkConfigured: true }
  | { status: 'signed_out'; clerkConfigured: true }
  | {
      status: 'needs_task'
      clerkConfigured: true
      signOut: () => Promise<void>
    }
  | {
      status: 'signed_in'
      clerkConfigured: true
      clerkUserId: string
      displayName: string
      imageUrl?: string
      signOut: () => Promise<void>
    }

const MobileAuthContext = createContext<MobileAuthState>({ status: 'demo', clerkConfigured: false })

export function MobileAuthStateProvider({ value, children }: PropsWithChildren<{ value: MobileAuthState }>) {
  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>
}

export function ClerkAuthBridge({ children }: PropsWithChildren) {
  const auth = useAuth()
  const { isLoaded: sessionLoaded, session } = useSession()
  const { isLoaded: userLoaded, user } = useUser()
  const clerk = useClerk()

  const value = useMemo<MobileAuthState>(() => {
    if (!auth.isLoaded || !sessionLoaded) return { status: 'loading', clerkConfigured: true }
    if (session?.currentTask) {
      return {
        status: 'needs_task',
        clerkConfigured: true,
        signOut: async () => {
          await clerk.signOut()
        },
      }
    }
    if (!userLoaded) return { status: 'loading', clerkConfigured: true }
    if (!auth.isSignedIn || !user) return { status: 'signed_out', clerkConfigured: true }

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    const displayName = user.fullName?.trim() || fullName || user.username?.trim() || 'New friend'
    const identity = {
      clerkUserId: user.id,
      displayName,
      imageUrl: user.hasImage ? user.imageUrl : undefined,
    }

    return {
      status: 'signed_in',
      clerkConfigured: true,
      ...identity,
      signOut: async () => {
        await clerk.signOut()
      },
    }
  }, [auth.isLoaded, auth.isSignedIn, clerk, session?.currentTask, sessionLoaded, user, userLoaded])

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>
}

export function useMobileAuth() {
  return useContext(MobileAuthContext)
}
