import { Children, useEffect, useState, type ReactNode } from 'react'

type RouteTarget = string | Record<string, unknown>
type NavigatorProps = { children?: ReactNode }
type ProtectedProps = NavigatorProps & { guard?: boolean }
type TabScreenOptions = { title?: string; tabBarAccessibilityLabel?: string; tabBarBadge?: number }
type TabScreenProps = { name?: string; options?: TabScreenOptions }
type TabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string; params?: Record<string, unknown> }> }
  descriptors: Record<string, { options: TabScreenOptions }>
  navigation: { emit: () => { defaultPrevented: boolean }; navigate: (name: string) => void }
  insets: { top: number; right: number; bottom: number; left: number }
}

export const router = {
  push: async (_target: RouteTarget) => {},
  navigate: async (_target: RouteTarget) => {},
  replace: async (_target: RouteTarget) => {},
  setParams: (_params?: Record<string, unknown>) => {},
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

export function useIsFocused() {
  return true
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

function collectScreens(children: ReactNode, screens: TabScreenProps[] = []) {
  Children.forEach(children, (child) => {
    if (!child || typeof child !== 'object' || !('type' in child) || !('props' in child)) return
    const element = child as { type: unknown; props: Record<string, unknown> }
    if (element.type === TabsScreen) {
      screens.push({ name: String(element.props.name ?? screens.length), options: element.props.options as TabScreenOptions | undefined })
      return
    }
    if (element.type === Protected) {
      if (element.props.guard !== false) collectScreens(element.props.children as ReactNode, screens)
      return
    }
    if (element.props.children) collectScreens(element.props.children as ReactNode, screens)
  })
  return screens
}

function TabsNavigator({ children, tabBar }: NavigatorProps & { tabBar?: (props: TabBarProps) => ReactNode }) {
  const screens = collectScreens(children)
  const [index, setIndex] = useState(0)
  const state = {
    index,
    routes: screens.map((screen, position) => ({ key: String(position), name: screen.name ?? String(position), params: {} })),
  }
  const descriptors = Object.fromEntries(
    screens.map((screen, position) => [String(position), { options: screen.options ?? {} }]),
  )
  const navigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name: string) => {
      const next = state.routes.findIndex((route) => route.name === name)
      if (next >= 0) setIndex(next)
    },
  }
  const insets = { top: 0, right: 0, bottom: 24, left: 0 }

  if (tabBar) return <>{tabBar({ state, descriptors, navigation, insets })}</>

  return (
    <div role="tablist" aria-label="App navigation" style={{ display: 'flex', gap: 8 }}>
      {screens.map((screen, position) => {
        const label = screen.options?.tabBarAccessibilityLabel ?? screen.options?.title ?? 'App tab'
        return (
          <button type="button" role="tab" aria-label={label} aria-selected={position === index ? 'true' : 'false'} key={position}>
            {screen.options?.title}
            {typeof screen.options?.tabBarBadge === 'number' ? ` (${screen.options.tabBarBadge})` : ''}
          </button>
        )
      })}
    </div>
  )
}

function TabsScreen(_props: TabScreenProps) {
  return null
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
