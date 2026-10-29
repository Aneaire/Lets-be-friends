import { isValidElement, type ReactNode } from 'react'

jest.mock('convex/react', () => ({ useQuery: () => [] }))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@/backend/client', () => ({ mobileApi: { circles: { mine: 'circles.mine' } } }))
jest.mock('@/theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      surfaceRaised: '#202020',
      border: '#353535',
      socialSoft: '#321D2B',
      socialText: '#EA91C9',
      textMuted: '#B8B8B8',
    },
  }),
}))

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { DiscoverCirclesEntry } from '@/features/circles/CircleEntryPoints'

type TestElement = {
  type: unknown
  props: Record<string, any> & { children?: ReactNode }
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

describe('Discover circles entry', () => {
  it('marks the discovery card with a group icon instead of an empty circle', () => {
    const tree = DiscoverCirclesEntry()
    const triggers = findAll(tree, (node) => node.props?.accessibilityLabel === 'Discover circles')
    const icons = findAll(tree, (node) => node.type === AppIcon)

    expect(triggers).toHaveLength(1)
    expect(icons).toHaveLength(1)
    expect(icons[0].props.name).toBe('people')
    expect(icons[0].props.color).toBe('#EA91C9')
  })
})
