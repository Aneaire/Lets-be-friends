import { isValidElement, type ReactNode } from 'react'

const mockUseVideoPlayer = jest.fn()
const mockUseEvent = jest.fn(() => ({ status: 'ready' }))
const mockUseFocusEffect = jest.fn()

jest.mock('expo-video', () => ({
  useVideoPlayer: (...args: unknown[]) => Reflect.apply(mockUseVideoPlayer, undefined, args),
  VideoView: 'VideoView',
}), { virtual: true })

jest.mock('expo', () => ({
  useEvent: (...args: unknown[]) => Reflect.apply(mockUseEvent, undefined, args),
}), { virtual: true })

jest.mock('expo-router', () => ({
  useFocusEffect: (...args: unknown[]) => Reflect.apply(mockUseFocusEffect, undefined, args),
}))

import { BackHandler } from 'react-native'

import { NativeVideoViewer } from '@/features/media/NativeVideoViewer'
import { VideoViewerShell } from '@/features/media/VideoViewerShell'
import { VIDEO_VIEWER_UNAVAILABLE_MESSAGE } from '@/features/media/videoPresentation'

type TestElement = {
  type: unknown
  props: Record<string, unknown> & { children?: ReactNode }
}

function asElement(value: unknown): TestElement {
  if (!isValidElement(value)) throw new Error('Expected a React element')
  return value as unknown as TestElement
}

function childList(element: TestElement): TestElement[] {
  const children = element.props.children
  const flat: ReactNode[] = Array.isArray(children) ? children : [children]
  return flat.flat(Infinity).filter(isValidElement).map((child) => child as unknown as TestElement)
}

describe('native video viewer open gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(BackHandler, 'addEventListener')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([[null], [undefined], [''], ['   ']])('stays closed and creates nothing while the url is %p', (url) => {
    expect(NativeVideoViewer({ url: url ?? null, onClose: jest.fn() })).toBeNull()
    expect(mockUseVideoPlayer).not.toHaveBeenCalled()
    expect(BackHandler.addEventListener).not.toHaveBeenCalled()
  })

  it('mounts the active player only while a valid url is open', () => {
    const onClose = jest.fn()

    const element = asElement(NativeVideoViewer({ url: '  https://example.com/clip.mp4  ', title: 'Weekend plans', onClose }))

    expect(typeof element.type).toBe('function')
    expect((element.type as { name?: string }).name).toBe('ActiveVideoPlayer')
    expect(element.props.url).toBe('https://example.com/clip.mp4')
    expect(element.props.title).toBe('Weekend plans')
    expect(element.props.onClose).toBe(onClose)
    expect(mockUseVideoPlayer).not.toHaveBeenCalled()
    expect(BackHandler.addEventListener).not.toHaveBeenCalled()
  })

  it('shows the unavailable error state without a player for an invalid open url', () => {
    const onClose = jest.fn()

    const element = asElement(NativeVideoViewer({ url: 'nota-url-but-present', onClose }))
    const children = childList(element)

    const shells = children.filter((child) => child.type === VideoViewerShell)
    expect(shells).toHaveLength(1)
    expect(shells[0].props.error).toBe(VIDEO_VIEWER_UNAVAILABLE_MESSAGE)
    expect(shells[0].props.onClose).toBe(onClose)
    expect(children.some((child) => typeof child.type === 'function' && (child.type as { name?: string }).name === 'VideoBackHandler')).toBe(true)
    expect(mockUseVideoPlayer).not.toHaveBeenCalled()
    expect(BackHandler.addEventListener).not.toHaveBeenCalled()
  })

  it('follows url transitions and releases everything on close', () => {
    const onClose = jest.fn()

    const first = asElement(NativeVideoViewer({ url: 'https://example.com/first.mp4', onClose }))
    const second = asElement(NativeVideoViewer({ url: 'https://example.com/second.mp4', onClose }))
    expect(first.props.url).toBe('https://example.com/first.mp4')
    expect(second.props.url).toBe('https://example.com/second.mp4')

    expect(NativeVideoViewer({ url: null, onClose })).toBeNull()
    expect(mockUseVideoPlayer).not.toHaveBeenCalled()
    expect(BackHandler.addEventListener).not.toHaveBeenCalled()
  })

  it('keeps every user-facing gate string free of em dashes', () => {
    expect(VIDEO_VIEWER_UNAVAILABLE_MESSAGE).not.toContain('\u2014')
  })
})
