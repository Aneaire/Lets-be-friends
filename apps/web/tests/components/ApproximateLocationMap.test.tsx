// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApproximateLocationMap } from '../../src/design-system/organisms/ApproximateLocationMap'

afterEach(cleanup)

describe('ApproximateLocationMap', () => {
  it('exposes pin mode on the map only when location placement is enabled', () => {
    const { container, rerender } = render(
      <ApproximateLocationMap location={null} pinnable onChange={vi.fn()} />,
    )
    expect(container.querySelector('figure')?.getAttribute('data-pinnable')).toBe('true')

    rerender(<ApproximateLocationMap location={null} pinnable />)
    expect(container.querySelector('figure')?.getAttribute('data-pinnable')).toBe('false')
  })
})
