import { BlurTargetView } from 'expo-blur'
import { useIsFocused } from 'expo-router'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from 'react'
import { StyleSheet, View } from 'react-native'

type TabBarBlurTargetValue = {
  targetRef: RefObject<View | null>
  setTarget: (node: View | null) => void
}

const TabBarBlurTargetContext = createContext<TabBarBlurTargetValue | null>(null)

/**
 * The Android blur implementation requires the BlurView to sit outside the
 * BlurTargetView. The tab bar is a sibling of the tab screens, so each focused
 * tab screen registers its content as the blur target and the tab bar's
 * BlurView reads that target from context.
 */
export function TabBarBlurTargetProvider({ children }: PropsWithChildren) {
  const [target, setTarget] = useState<View | null>(null)
  const value = useMemo(() => ({
    targetRef: { current: target } as RefObject<View | null>,
    setTarget,
  }), [target])

  return (
    <TabBarBlurTargetContext.Provider value={value}>
      {children}
    </TabBarBlurTargetContext.Provider>
  )
}

export function useTabBarBlurTarget() {
  return useContext(TabBarBlurTargetContext)?.targetRef
}

export function TabBarBlurTarget({ children }: PropsWithChildren) {
  const context = useContext(TabBarBlurTargetContext)
  if (!context) return <>{children}</>
  return <FocusedTabBarBlurTarget setTarget={context.setTarget}>{children}</FocusedTabBarBlurTarget>
}

function FocusedTabBarBlurTarget({
  children,
  setTarget,
}: PropsWithChildren<{ setTarget: (node: View | null) => void }>) {
  const isFocused = useIsFocused()
  const ref = useRef<View>(null)

  useEffect(() => {
    if (!isFocused) return
    setTarget(ref.current)
    return () => setTarget(null)
  }, [isFocused, setTarget])

  return (
    <BlurTargetView ref={ref} style={styles.target}>
      {children}
    </BlurTargetView>
  )
}

const styles = StyleSheet.create({
  target: { flex: 1 },
})
