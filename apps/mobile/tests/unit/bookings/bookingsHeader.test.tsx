import { isValidElement, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { formatPhp } from '@lets-be-friends/shared'

import { AppText } from '@/design-system/atoms/Typography'
import {
  BOOKINGS_WALLET_ROUTE,
  BookingsHeader,
  bookingsWalletPresentation,
  bookingsWalletQueryArgs,
} from '@/features/booking/BookingsHeader'
import { resolveTheme } from '@/theme/tokens'

jest.mock('@/theme/ThemeProvider', () => {
  const { resolveTheme } = require('@/theme/tokens')
  return { useAppTheme: () => resolveTheme('light') }
})

type TestElement = {
  type: unknown
  props: Record<string, unknown> & { children?: ReactNode }
}

function asElements(value: unknown): TestElement[] {
  const flat = Array.isArray(value) ? value : [value]
  return flat.flat(Infinity).filter(isValidElement) as unknown as TestElement[]
}

function findAll(element: unknown, predicate: (node: TestElement) => boolean): TestElement[] {
  const matches: TestElement[] = []
  const visit = (node: unknown) => {
    if (!isValidElement(node)) return
    const candidate = node as unknown as TestElement
    if (predicate(candidate)) matches.push(candidate)
    for (const child of asElements(candidate.props.children)) visit(child)
  }
  visit(element)
  return matches
}

function textContent(element: unknown): string {
  if (typeof element === 'string' || typeof element === 'number') return String(element)
  if (!isValidElement(element)) return ''
  const children = (element as unknown as TestElement).props.children
  return asElements(children).map(textContent).join('') + (typeof children === 'string' ? children : '')
}

describe('bookings header wallet link', () => {
  it('shows the formatted available balance with an accessible wallet target', () => {
    const onOpenWallet = jest.fn()
    const element = BookingsHeader({ wallet: { availableCentavos: 245_000 }, onOpenWallet })

    expect(bookingsWalletPresentation({ availableCentavos: 245_000 })).toEqual({
      state: 'ready',
      label: formatPhp(245_000),
      accessibilityLabel: `Open wallet, available balance ${formatPhp(245_000)}`,
    })

    const buttons = findAll(element, (node) => node.type === Pressable)
    expect(buttons).toHaveLength(1)
    expect(buttons[0].props.accessibilityRole).toBe('button')
    expect(buttons[0].props.accessibilityLabel).toBe(`Open wallet, available balance ${formatPhp(245_000)}`)
    ;(buttons[0].props.onPress as () => void)()
    expect(onOpenWallet).toHaveBeenCalledTimes(1)
    expect(BOOKINGS_WALLET_ROUTE).toBe('/wallet')
  })

  it('keeps the balance target reachable while the wallet is loading without inventing a zero balance', () => {
    const onOpenWallet = jest.fn()
    const element = BookingsHeader({ wallet: undefined, onOpenWallet })

    expect(bookingsWalletPresentation(undefined).state).toBe('loading')
    expect(bookingsWalletPresentation(undefined).label).not.toContain(formatPhp(0))
    const labels = findAll(element, (node) => node.type === AppText).map((node) => textContent(node))
    expect(labels.join(' ')).toContain('Balance loading…')
    expect(labels.join(' ')).not.toContain(formatPhp(0))

    const buttons = findAll(element, (node) => node.type === Pressable)
    expect(buttons).toHaveLength(1)
    ;(buttons[0].props.onPress as () => void)()
    expect(onOpenWallet).toHaveBeenCalledTimes(1)
  })

  it('shows an honest unavailable state that still opens the wallet', () => {
    const onOpenWallet = jest.fn()
    const element = BookingsHeader({ wallet: null, onOpenWallet })

    expect(bookingsWalletPresentation(null)).toMatchObject({ state: 'unavailable', label: 'Balance unavailable' })
    const labels = findAll(element, (node) => node.type === AppText).map((node) => textContent(node))
    expect(labels.join(' ')).toContain('Balance unavailable')
    expect(labels.join(' ')).not.toContain(formatPhp(0))

    const buttons = findAll(element, (node) => node.type === Pressable)
    ;(buttons[0].props.onPress as () => void)()
    expect(onOpenWallet).toHaveBeenCalledTimes(1)
  })

  it('removes the old subtitle and meets the minimum touch target with self semantics', () => {
    const element = BookingsHeader({ wallet: { availableCentavos: 100_00 }, onOpenWallet: jest.fn() })
    const labels = findAll(element, (node) => node.type === AppText).map((node) => textContent(node))
    expect(labels.join('\n')).not.toContain('Scan requests, upcoming plans, and history.')
    expect(labels).toContainEqual('Bookings')

    const theme = resolveTheme('light')
    const balanceText = findAll(
      element,
      (node) => node.type === AppText && typeof node.props.children === 'string' && String(node.props.children) === formatPhp(100_00),
    )
    expect(balanceText).toHaveLength(1)
    expect(balanceText[0].props.color).toBe(theme.colors.selfText)

    const buttons = findAll(element, (node) => node.type === Pressable)
    const styleProp = buttons[0].props.style as unknown as (state: { pressed: boolean }) => unknown
    const resolved = StyleSheet.flatten(styleProp({ pressed: false }) as Parameters<typeof StyleSheet.flatten>[0]) as {
      minHeight?: number
      backgroundColor?: string
    }
    expect(resolved.minHeight).toBeGreaterThanOrEqual(44)
    const pressedResolved = StyleSheet.flatten(styleProp({ pressed: true }) as Parameters<typeof StyleSheet.flatten>[0]) as {
      minHeight?: number
      opacity?: number
      backgroundColor?: string
    }
    expect(pressedResolved.opacity).toBe(0.7)
    expect(resolved.backgroundColor).toBeUndefined()

    const pillCandidates = findAll(element, (node) => node.type === View).map((node) =>
      StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]),
    ) as Array<{
      paddingVertical?: number
      paddingHorizontal?: number
      borderWidth?: number
      borderRadius?: number
      minHeight?: number
      backgroundColor?: string
      borderColor?: string
    }>
    const pills = pillCandidates.filter((style) => style.paddingVertical === 4)
    expect(pills).toHaveLength(1)
    expect(pills[0].paddingHorizontal).toBe(12)
    expect(pills[0].borderWidth).toBe(StyleSheet.hairlineWidth)
    expect(pills[0].borderRadius).toBe(14)
    expect(pills[0].backgroundColor).toBe(theme.colors.selfSoft)
    expect(pills[0].borderColor).toBe(theme.colors.selfText)
    expect(pills[0].minHeight ?? 0).toBeLessThan(44)
  })

  it('gates the wallet query on a ready member so auth states never query finance', () => {
    expect(bookingsWalletQueryArgs('ready')).toEqual({})
    expect(bookingsWalletQueryArgs('loading')).toBe('skip')
    expect(bookingsWalletQueryArgs('signed_out')).toBe('skip')
    expect(bookingsWalletQueryArgs('unconfigured')).toBe('skip')
    expect(bookingsWalletQueryArgs('unavailable')).toBe('skip')
    expect(bookingsWalletQueryArgs('error')).toBe('skip')
  })
})
