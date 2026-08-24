import { useEffect, type ReactNode } from 'react'

type RouteTarget = string | Record<string, unknown>
type NavigatorProps = { children?: ReactNode }
type ProtectedProps = NavigatorProps & { guard?: boolean }

export const router = {
  push: async (_target: RouteTarget) => {},
  replace: async (_target: RouteTarget) => {},
  back: () => {},
  canGoBack: () => false,
}

export function useLocalSearchParams<T = Record<string, string | string[]>>(): T {
  return {} as T
}

export function useRouter() {
  return router
}

export function usePathname() {
  return '/'
}

export function useSegments() {
  return [] as string[]
}

export function useFocusEffect(callback: () => void | (() => void)) {
  useEffect(() => callback(), [callback])
}

export function Link({ children }: NavigatorProps & { href?: RouteTarget }) {
  return <>{children}</>
}

export function Redirect(_props: Record<string, unknown>) {
  return null
}

function Navigator({ children }: NavigatorProps) {
  return <>{children}</>
}

function Screen(_props: Record<string, unknown>) {
  return null
}

function TabsNavigator({ children }: NavigatorProps) {
  return <div role="tablist" aria-label="App navigation" style={{ display: 'flex', gap: 8 }}>{children}</div>
}

function TabsScreen({ options }: { options?: { title?: string; tabBarAccessibilityLabel?: string; tabBarBadge?: number } }) {
  const label = options?.tabBarAccessibilityLabel ?? options?.title ?? 'App tab'
  return (
    <button type="button" role="tab" aria-label={label} aria-selected="false">
      {options?.title}
      {typeof options?.tabBarBadge === 'number' ? ` (${options.tabBarBadge})` : ''}
    </button>
  )
}

function Protected({ children, guard = true }: ProtectedProps) {
  return guard ? <>{children}</> : null
}

export const Stack = Object.assign(Navigator, { Screen, Protected })
export const Tabs = Object.assign(TabsNavigator, { Screen: TabsScreen, Protected })

export function Slot({ children }: NavigatorProps) {
  return <>{children}</>
}

export default router
