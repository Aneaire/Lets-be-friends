import { Component, useCallback, useState, type ReactNode } from 'react'
import { useClerk } from '@clerk/expo'
import { router } from 'expo-router'

import { Screen } from '@/design-system/templates/Screen'
import { StateView } from '@/design-system/molecules/StateView'

import {
  genericErrorFallbackCopy,
  isSessionEndedError,
  sessionEndedFallbackCopy,
} from '@/app/appErrorModel'

type BoundaryProps = {
  children: ReactNode
  onSessionEnded: () => Promise<void> | void
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
            onAction={() => router.replace('/auth')}
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
 * ends the session, and anything else shows a retry screen instead of the
 * Android "app has stopped" dialog.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const clerk = useClerk()
  const [resetKey, setResetKey] = useState(0)

  const handleSessionEnded = useCallback(async () => {
    try {
      await clerk.signOut()
    } catch {
      // The identity may already be gone, which is the expected end state.
    }
    setResetKey((value) => value + 1)
  }, [clerk])

  return (
    <AppErrorBoundaryInner key={resetKey} onSessionEnded={handleSessionEnded}>
      {children}
    </AppErrorBoundaryInner>
  )
}
