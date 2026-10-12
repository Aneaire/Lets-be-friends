import { isValidElement, type ReactNode } from 'react'
import { Modal, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { VideoViewerShell } from '@/features/media/VideoViewerShell'
import { VIDEO_VIEWER_ERROR_MESSAGE } from '@/features/media/videoPresentation'

let mockScheme: 'light' | 'dark' = 'light'

jest.mock('@/theme/ThemeProvider', () => {
  const { resolveTheme } = require('@/theme/tokens')
  return { useAppTheme: () => resolveTheme(mockScheme) }
})

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}))

type TestElement = {
  type: unknown
  props: Record<string, unknown> & { children?: ReactNode }
}

function childElements(element: TestElement): TestElement[] {
  const children = (element.props as { children?: ReactNode }).children
  const flat: ReactNode[] = Array.isArray(children) ? children : [children]
  const found: TestElement[] = []
  for (const child of flat.flat(Infinity)) {
    if (isValidElement(child)) found.push(child as unknown as TestElement)
  }
  return found
}

function findAll(element: TestElement, predicate: (candidate: TestElement) => boolean): TestElement[] {
  const matches: TestElement[] = []
  const visit = (node: TestElement) => {
    if (predicate(node)) matches.push(node)
    for (const child of childElements(node)) visit(child)
  }
  visit(element)
  return matches
}

function press(element: TestElement, name: string) {
  const handler: unknown = element.props[name]
  if (typeof handler !== 'function') throw new Error(`Expected ${name} to be a function`)
  ;(handler as () => void)()
}

function shellTree(element: unknown) {
  return element as TestElement
}

describe('video viewer shell', () => {
  beforeEach(() => {
    mockScheme = 'light'
  })

  it('presents a visible modal that closes through the system back action', () => {
    const onClose = jest.fn()

    const element = VideoViewerShell({
      title: 'Weekend plans',
      error: null,
      onClose,
      onRetry: jest.fn(),
      children: <View />,
    })

    const modal = findAll(shellTree(element), (node) => node.type === Modal)
    expect(modal).toHaveLength(1)
    expect(modal[0].props.visible).toBe(true)
    expect(modal[0].props.transparent).toBe(false)
    expect(modal[0].props.accessibilityLabel).toBe('Weekend plans video player')
    expect(modal[0].props.accessibilityViewIsModal).toBeUndefined()
    press(modal[0], 'onRequestClose')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uses dark theme text on an opaque dark theme surface', () => {
    mockScheme = 'dark'
    const element = VideoViewerShell({
      title: 'Weekend plans',
      error: null,
      onClose: jest.fn(),
      onRetry: jest.fn(),
      children: <View />,
    })

    const title = findAll(element, (node) => node.type === AppText && node.props.children === 'Weekend plans')
    const viewer = findAll(element, (node) => node.type === View && node.props.accessibilityLabel === 'Weekend plans video player')
    expect(title).toHaveLength(1)
    expect(title[0].props.color).toBe('#FFFFFF')
    const viewerStyle = StyleSheet.flatten(viewer[0].props.style as Parameters<typeof StyleSheet.flatten>[0]) as { backgroundColor?: string }
    expect(viewerStyle.backgroundColor).toBe('#090909')
  })

  it('labels the viewer as modal and wires the escape action to close', () => {
    const onClose = jest.fn()

    const element = VideoViewerShell({
      title: 'Weekend plans',
      error: null,
      onClose,
      onRetry: jest.fn(),
      children: <View />,
    })

    const dialog = findAll(
      element,
      (node) => node.type === View && node.props.accessibilityLabel === 'Weekend plans video player',
    )
    expect(dialog).toHaveLength(1)
    expect(dialog[0].props.role).toBe('dialog')
    expect(dialog[0].props.accessibilityViewIsModal).toBe(true)
    press(dialog[0], 'onAccessibilityEscape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes through the visible close button', () => {
    const onClose = jest.fn()

    const element = VideoViewerShell({
      title: 'Weekend plans',
      error: null,
      onClose,
      onRetry: jest.fn(),
      children: <View />,
    })

    const closeButtons = findAll(
      element,
      (node) => node.type === IconButton && node.props.label === 'Close video viewer',
    )
    expect(closeButtons).toHaveLength(1)
    press(closeButtons[0], 'onPress')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the injected playback slot without an error state', () => {
    const playback = <View testID="mock-playback" />

    const element = VideoViewerShell({
      title: 'Weekend plans',
      error: null,
      onClose: jest.fn(),
      onRetry: jest.fn(),
      children: playback,
    })

    expect(findAll(shellTree(element), (node) => node.props?.testID === 'mock-playback')).toHaveLength(1)
    expect(findAll(shellTree(element), (node) => node.type === ActionButton)).toHaveLength(0)
  })

  it('shows fixed product copy with a retry action when playback fails', () => {
    const onRetry = jest.fn()

    const element = VideoViewerShell({
      title: 'Weekend plans',
      error: VIDEO_VIEWER_ERROR_MESSAGE,
      onClose: jest.fn(),
      onRetry,
      children: <View />,
    })

    const alerts = findAll(
      element,
      (node) => node.type === View && node.props.accessibilityRole === 'alert',
    )
    expect(alerts).toHaveLength(1)

    const retryButtons = findAll(
      element,
      (node) => node.type === ActionButton && node.props.label === 'Try again',
    )
    expect(retryButtons).toHaveLength(1)
    press(retryButtons[0], 'onPress')
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
