import { forwardRef, type ReactNode } from 'react'
import { View, type ViewProps } from 'react-native'

type BlurProps = ViewProps & {
  tint?: string
  intensity?: number
  blurMethod?: string
  blurTarget?: unknown
  blurReductionFactor?: number
}

export const BlurView = forwardRef<View, BlurProps>(function BlurView(
  { tint, intensity = 50, blurMethod: _blurMethod, blurTarget: _blurTarget, blurReductionFactor: _blurReductionFactor, style, ...props },
  ref,
) {
  const dark = Boolean(tint?.toLowerCase().includes('dark'))
  const blur = `saturate(1.35) blur(${Math.max(8, Math.min(28, intensity * 0.5))}px)`
  return (
    <View
      ref={ref}
      {...props}
      style={[
        style,
        {
          backgroundColor: dark ? 'rgba(32, 32, 32, 0.35)' : 'rgba(255, 255, 255, 0.35)',
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
        } as never,
      ]}
    />
  )
})

export const BlurTargetView = forwardRef<View, ViewProps & { children?: ReactNode }>(function BlurTargetView(
  { children, ...props },
  ref,
) {
  return (
    <View ref={ref} {...props}>
      {children}
    </View>
  )
})
