import type { FunctionReturnType } from 'convex/server'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useMobileAuth } from '@/auth/MobileAuth'
import { mobileApi } from '@/backend/client'

import { isViewerForClerkUser } from './account'

type Viewer = NonNullable<FunctionReturnType<typeof mobileApi.users.viewer>>
type MemberVerification = FunctionReturnType<typeof mobileApi.users.latestMemberVerification>

export type MobileMemberState =
  | { status: 'unconfigured' }
  | { status: 'signed_out' }
  | { status: 'loading' | 'syncing' }
  | { status: 'unavailable' | 'error'; message: string }
  | { status: 'ready'; viewer: Viewer; verification: MemberVerification }

const MobileMemberContext = createContext<MobileMemberState>({ status: 'unconfigured' })

export function MobileMemberStateProvider({ value, children }: PropsWithChildren<{ value: MobileMemberState }>) {
  return <MobileMemberContext.Provider value={value}>{children}</MobileMemberContext.Provider>
}

export function AuthenticatedMemberProvider({ children }: PropsWithChildren) {
  const auth = useMobileAuth()
  const convexAuth = useConvexAuth()
  const canReadViewer = auth.status === 'signed_in' && convexAuth.isAuthenticated
  const viewer = useQuery(mobileApi.users.viewer, canReadViewer ? {} : 'skip')
  const viewerMatchesAccount = auth.status === 'signed_in' && isViewerForClerkUser(viewer, auth.clerkUserId)
  const verification = useQuery(mobileApi.users.latestMemberVerification, canReadViewer && viewerMatchesAccount ? {} : 'skip')
  const ensureViewer = useMutation(mobileApi.users.ensureViewer)
  const attemptedUserId = useRef<string | null>(null)
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null)
  const [syncErrorUserId, setSyncErrorUserId] = useState<string | null>(null)

  const clerkUserId = auth.status === 'signed_in' ? auth.clerkUserId : null
  useEffect(() => {
    attemptedUserId.current = null
    setSyncingUserId(null)
    setSyncErrorUserId(null)
  }, [clerkUserId])

  useEffect(() => {
    if (auth.status !== 'signed_in' || !convexAuth.isAuthenticated || viewer !== null) return
    if (attemptedUserId.current === auth.clerkUserId) return

    const userId = auth.clerkUserId
    attemptedUserId.current = userId
    setSyncingUserId(userId)
    setSyncErrorUserId(null)

    void ensureViewer({
      expectedClerkUserId: userId,
      displayName: auth.displayName,
    }).then(
      () => setSyncingUserId((current) => current === userId ? null : current),
      () => {
        setSyncingUserId((current) => current === userId ? null : current)
        setSyncErrorUserId(userId)
      },
    )
  }, [auth, convexAuth.isAuthenticated, ensureViewer, viewer])

  const value = useMemo<MobileMemberState>(() => {
    if (auth.status === 'unconfigured') return { status: 'unconfigured' }
    if (auth.status === 'setup_error') return { status: 'unavailable', message: auth.message }
    if (auth.status === 'loading') return { status: 'loading' }
    if (auth.status === 'signed_out') return { status: 'signed_out' }
    if (auth.status === 'needs_task') {
      return {
        status: 'unavailable',
        message: 'Complete the required account security step before connecting member data.',
      }
    }
    if (convexAuth.isLoading) return { status: 'loading' }
    if (!convexAuth.isAuthenticated) {
      return {
        status: 'error',
        message: 'Your member profile could not be connected. Please try again later.',
      }
    }
    if (viewer === undefined) return { status: 'loading' }
    if (viewer === null) {
      if (syncErrorUserId === auth.clerkUserId) {
        return { status: 'error', message: 'Your member account could not be prepared. Please try again later.' }
      }
      return { status: syncingUserId === auth.clerkUserId ? 'syncing' : 'loading' }
    }
    if (!isViewerForClerkUser(viewer, auth.clerkUserId)) return { status: 'loading' }
    if (viewer.suspended) return { status: 'error', message: 'This account is not available for member actions.' }
    if (verification === undefined) return { status: 'loading' }
    return { status: 'ready', viewer, verification }
  }, [auth, convexAuth.isAuthenticated, convexAuth.isLoading, syncingUserId, syncErrorUserId, verification, viewer])

  return <MobileMemberContext.Provider value={value}>{children}</MobileMemberContext.Provider>
}

export function useMobileMember() {
  return useContext(MobileMemberContext)
}
