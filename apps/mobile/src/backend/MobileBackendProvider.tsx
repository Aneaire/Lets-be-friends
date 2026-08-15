import { ClerkProvider, useAuth } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo } from 'react'

import { ClerkAuthBridge, MobileAuthStateProvider } from '@/auth/MobileAuth'
import { MemberDataBoundary } from '@/member/MemberDataBoundary'
import { AuthenticatedMemberProvider, MobileMemberStateProvider } from '@/member/MobileMember'
import { PushNotificationsProvider } from '@/notifications/PushNotifications'

import {
  resolveMobileBackendConfiguration,
  resolveMobileClerkConfiguration,
  type MobileBackendConfiguration,
} from './config'

const MobileBackendContext = createContext<MobileBackendConfiguration>({ status: 'missing' })

export function MobileBackendProvider({ children }: PropsWithChildren) {
  const backendConfiguration = resolveMobileBackendConfiguration()
  const clerkConfiguration = resolveMobileClerkConfiguration()
  const clientUrl = backendConfiguration.status === 'configured' ? backendConfiguration.url : null
  const client = useMemo(() => clientUrl ? new ConvexReactClient(clientUrl) : null, [clientUrl])

  useEffect(() => {
    return () => {
      if (client) void client.close()
    }
  }, [client])

  const content = (
    <MobileBackendContext.Provider value={backendConfiguration}>
      {children}
    </MobileBackendContext.Provider>
  )

  if (clerkConfiguration.status === 'configured') {
    return (
      <ClerkProvider publishableKey={clerkConfiguration.publishableKey} tokenCache={tokenCache}>
        <ClerkAuthBridge>
          {client ? (
            <AuthenticatedBackend client={client}>{content}</AuthenticatedBackend>
          ) : (
            <MobileMemberStateProvider value={{
              status: 'unavailable',
              message: backendConfiguration.status === 'invalid'
                ? backendConfiguration.message
                : 'Member services are unavailable in this build.',
            }}>
              {content}
            </MobileMemberStateProvider>
          )}
        </ClerkAuthBridge>
      </ClerkProvider>
    )
  }

  const authState = clerkConfiguration.status === 'invalid'
    ? { status: 'setup_error' as const, clerkConfigured: false as const, message: clerkConfiguration.message }
    : { status: 'unconfigured' as const, clerkConfigured: false as const }
  const memberState = clerkConfiguration.status === 'invalid'
    ? { status: 'unavailable' as const, message: clerkConfiguration.message }
    : { status: 'unconfigured' as const }
  const anonymousContent = (
    <MobileAuthStateProvider value={authState}>
      <MobileMemberStateProvider value={memberState}>{content}</MobileMemberStateProvider>
    </MobileAuthStateProvider>
  )

  return client ? <ConvexProvider client={client}>{anonymousContent}</ConvexProvider> : anonymousContent
}

export function useMobileBackendConfiguration() {
  return useContext(MobileBackendContext)
}

function AuthenticatedBackend({ client, children }: PropsWithChildren<{ client: ConvexReactClient }>) {
  const { sessionId, userId } = useAuth()
  const accountKey = `${sessionId ?? 'no-session'}:${userId ?? 'no-user'}`

  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      <MemberDataBoundary resetKey={accountKey}>
        <AuthenticatedMemberProvider key={accountKey}>
          <PushNotificationsProvider>{children}</PushNotificationsProvider>
        </AuthenticatedMemberProvider>
      </MemberDataBoundary>
    </ConvexProviderWithClerk>
  )
}
