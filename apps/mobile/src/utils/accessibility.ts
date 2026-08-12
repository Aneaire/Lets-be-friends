import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useReducedMotion() {
  const [isReduced, setIsReduced] = useState(false)

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setIsReduced)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReduced)
    return () => subscription.remove()
  }, [])

  return isReduced
}
