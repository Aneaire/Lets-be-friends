import { isValidElement, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { density } from '@/theme/tokens'
import { OnboardingActionRow } from '@/features/onboarding/OnboardingActionRow'

jest.mock('@/theme/ThemeProvider', () => {
  const { resolveTheme } = require('@/theme/tokens')
  return { useAppTheme: () => resolveTheme('light') }
})

jest.mock('@/design-system/atoms/AppIcon', () => ({ AppIcon: 'AppIcon' }))

const { resolveTheme } = require('@/theme/tokens')
const theme = resolveTheme('light')

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

function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

function primaryElement(label = 'Continue') {
  return <ActionButton label={label} onPress={() => undefined} intent="self" />
}

describe('onboarding action row', () => {
  it('omits the back button on step 0 and lets the primary action fill the row', () => {
    const element = OnboardingActionRow({
      showBack: false,
      backDisabled: false,
      onBack: jest.fn(),
      primary: primaryElement(),
    }) as unknown as TestElement

    const backs = findAll(
      element,
      (node) => node.props?.accessibilityLabel === 'Go to previous step',
    )
    expect(backs).toHaveLength(0)

    const primaries = findAll(element, (node) => node.type === ActionButton)
    expect(primaries).toHaveLength(1)
    const primaryStyle = StyleSheet.flatten(primaries[0].props.style as never) as { flex?: number; minWidth?: number }
    expect(primaryStyle.flex).toBe(1)
    expect(primaryStyle.minWidth).toBe(0)
  })

  it('renders an icon-only chevron back button inline before the dominant primary button', () => {
    const onBack = jest.fn()
    const element = OnboardingActionRow({
      showBack: true,
      backDisabled: false,
      onBack,
      primary: primaryElement(),
    }) as unknown as TestElement

    const row = element
    expect(row.type).toBe(View)
    const rowStyle = StyleSheet.flatten(row.props.style as never) as {
      flexDirection?: string
      alignItems?: string
      gap?: number
    }
    expect(rowStyle.flexDirection).toBe('row')
    expect(rowStyle.alignItems).toBe('center')
    expect(rowStyle.gap).toBe(10)

    const backs = findAll(
      element,
      (node) => node.type === Pressable && node.props?.accessibilityLabel === 'Go to previous step',
    )
    expect(backs).toHaveLength(1)
    const back = backs[0]
    expect(back.props.accessibilityRole).toBe('button')
    expect(back.props.accessibilityState).toEqual({ disabled: false })
    expect(back.props.disabled).toBe(false)

    const icons = findAll(element, (node) => node.type === 'AppIcon')
    expect(icons).toHaveLength(1)
    expect(icons[0].props.name).toBe('chevron-back')
    expect(icons[0].props.color).toBe(theme.colors.text)

    expect(textOf(element)).not.toContain('Back')

    const directChildren = childElements(row)
    expect(directChildren[0].props?.accessibilityLabel).toBe('Go to previous step')
    expect(directChildren[1].type).toBe(ActionButton)
    const primaryStyle = StyleSheet.flatten(directChildren[1].props.style as never) as { flex?: number }
    expect(primaryStyle.flex).toBe(1)
  })

  it('sizes the back control as a neutral square and keeps the primary dominant', () => {
    const element = OnboardingActionRow({
      showBack: true,
      backDisabled: false,
      onBack: jest.fn(),
      primary: primaryElement(),
    }) as unknown as TestElement

    const back = findAll(
      element,
      (node) => node.type === Pressable && node.props?.accessibilityLabel === 'Go to previous step',
    )[0]
    const renderStyle = back.props.style as (state: { pressed: boolean }) => unknown
    const style = StyleSheet.flatten(renderStyle({ pressed: false }) as never) as Record<string, unknown>
    expect(style.width).toBe(density.controlHeight)
    expect(style.height).toBe(density.controlHeight)
    expect(style.borderRadius).toBe(density.controlRadius)
    expect(style.borderWidth).toBe(1)
    expect(style.backgroundColor).toBe(theme.colors.surface)
    expect(style.borderColor).toBe(theme.colors.border)
  })

  it('disables the back button while submitting and still calls back on press', () => {
    const onBack = jest.fn()
    const disabledElement = OnboardingActionRow({
      showBack: true,
      backDisabled: true,
      onBack,
      primary: primaryElement(),
    }) as unknown as TestElement

    const back = findAll(
      disabledElement,
      (node) => node.type === Pressable && node.props?.accessibilityLabel === 'Go to previous step',
    )[0]
    expect(back.props.disabled).toBe(true)
    expect(back.props.accessibilityState).toEqual({ disabled: true })
    const renderStyle = back.props.style as (state: { pressed: boolean }) => unknown
    const style = StyleSheet.flatten(renderStyle({ pressed: false }) as never) as { opacity?: number }
    expect(style.opacity).toBe(0.52)

    const enabledElement = OnboardingActionRow({
      showBack: true,
      backDisabled: false,
      onBack,
      primary: primaryElement(),
    }) as unknown as TestElement
    const enabledBack = findAll(
      enabledElement,
      (node) => node.type === Pressable && node.props?.accessibilityLabel === 'Go to previous step',
    )[0]
    ;(enabledBack.props.onPress as () => void)()
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
