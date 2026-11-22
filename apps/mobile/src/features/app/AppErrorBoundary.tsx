import { Component, useCallback, useRef, useState, type ReactNode } from 'react'

import { useMobileAuth, type MobileAuthState } from '@/auth/MobileAuth'
import { Screen } from '@/design-system/templates/Screen'
import { StateView } from '@/design-system/molecules/StateView'
import { isAccountDeletionInProgress } from '@/features/settings/accountDeletionModel'

import {
  genericErrorFallbackCopy,
  isSessionEndedError,
  sessionEndedFallbackCopy,
  shouldSignOutOnSessionEndedError,
} from './appErrorModel'

type BoundaryProps = {
  children: ReactNode
  authStatus: MobileAuthState['status']
  onSessionEnded: () => Promise<void> | void
  onRecoverSessionEnded: () => Promise<void> | void
}

type BoundaryState = {
  error: Error | null
}

class AppErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: unknown) {
    if (isSessionEndedError(error)) void this.props.onSessionEnded()
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (
      this.state.error
      && isSessionEndedError(this.state.error)
      && previousProps.authStatus !== 'signed_out'
      && this.props.authStatus === 'signed_out'
    ) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (isSessionEndedError(error)) {
      const copy = sessionEndedFallbackCopy()
      return (
        <Screen scroll={false} contentStyle={{ paddingHorizontal: 16 }}>
          <StateView
            eyebrow={copy.eyebrow}
            title={copy.title}
            detail={copy.detail}
            actionLabel={copy.actionLabel}
            onAction={() => void this.props.onRecoverSessionEnded()}
            intent="self"
          />
        </Screen>
      )
    }
    const copy = genericErrorFallbackCopy()
    return (
      <Screen scroll={false} contentStyle={{ paddingHorizontal: 16 }}>
        <StateView
          eyebrow={copy.eyebrow}
          title={copy.title}
          detail={copy.detail}
          actionLabel={copy.actionLabel}
          onAction={() => this.setState({ error: null })}
          intent="self"
        />
      </Screen>
    )
  }
}

/**
 * Wraps the whole navigation. Render errors stop being fatal: a closed account
 * ends the session without racing an active account deletion, and anything else
 * shows a retry screen instead of the Android "app has stopped" dialog.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const auth = useMobileAuth()
  const [resetKey, setResetKey] = useState(0)
  const signOutFlightRef = useRef<Promise<void> | null>(null)
  const authRef = useRef(auth)
  authRef.current = auth

  const ensureSignedOut = useCallback(async () => {
    const current = authRef.current
    if (!shouldSignOutOnSessionEndedError({
      authStatus: current.status,
      deletionInProgress: isAccountDeletionInProgress(),
    })) {
      return
    }
    if (current.status !== 'signed_in' && current.status !== 'needs_task') return
    if (signOutFlightRef.current) {
      await signOutFlightRef.current
      return
    }
    const flight = (async () => {
      try {
        await current.signOut()
      } catch {
        // The identity may already be gone, which is the expected end state.
      } finally {
        signOutFlightRef.current = null
      }
    })()
    signOutFlightRef.current = flight
    await flight
  }, [])

  const handleSessionEnded = useCallback(async () => {
    await ensureSignedOut()
  }, [ensureSignedOut])

  const handleRecoverSessionEnded = useCallback(async () => {
    await ensureSignedOut()
    setResetKey((value) => value + 1)
  }, [ensureSignedOut])

  return (
    <AppErrorBoundaryInner
      key={resetKey}
      authStatus={auth.status}
      onSessionEnded={handleSessionEnded}
      onRecoverSessionEnded={handleRecoverSessionEnded}
    >
      {children}
    </AppErrorBoundaryInner>
  )
}
