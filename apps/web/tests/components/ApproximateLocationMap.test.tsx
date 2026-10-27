// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { productMapBoundsForRadius } from '@lets-be-friends/shared'
import { ApproximateLocationMap } from '../../src/design-system/organisms/ApproximateLocationMap'
import ApproximateLocationMapClient from '../../src/design-system/organisms/ApproximateLocationMap.client'

let stubMapMounts = 0
let stubMapProps: Array<{
  bounds?: unknown
  zoom?: number
  center?: unknown
  onInitialLoadError?: () => void
}> = []

vi.mock('../../src/design-system/primitives/map.client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/design-system/primitives/map.client')>()
  return {
    ...actual,
    Map: (props: {
      bounds?: unknown
      zoom?: number
      center?: unknown
      onInitialLoadError?: () => void
    }) => {
      stubMapMounts += 1
      stubMapProps.push(props)
      const mountIndex = stubMapMounts
      useEffect(() => {
        // Only the first map mount fails, so a retry can succeed.
        if (mountIndex === 1) props.onInitialLoadError?.()
      }, [mountIndex, props])
      return <div data-testid="stub-map" />
    },
  }
})

beforeEach(() => {
  stubMapMounts = 0
  stubMapProps = []
})

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

  it('fits the map to the search radius so the circle fills the frame', () => {
    const location = { latitude: 15.03, longitude: 120.68 }
    render(
      <ApproximateLocationMapClient
        location={location}
        radiusKm={25}
        tone="social"
        interactive={false}
        pinnable={false}
      />,
    )

    expect(stubMapProps.at(-1)?.bounds).toEqual(productMapBoundsForRadius(location, 25))
  })

  it('keeps the fixed close-up view when no radius is supplied', () => {
    const location = { latitude: 15.03, longitude: 120.68 }
    render(
      <ApproximateLocationMapClient
        location={location}
        tone="self"
        interactive={false}
        pinnable={false}
      />,
    )

    expect(stubMapProps.at(-1)?.bounds).toBeNull()
    expect(stubMapProps.at(-1)?.zoom).toBe(11.5)
  })

  it('offers to try again when the map fails to load', () => {
    render(
      <ApproximateLocationMapClient
        location={null}
        tone="self"
        interactive={false}
        pinnable={false}
      />,
    )

    expect(screen.getByRole('status').textContent).toMatch(/map unavailable/i)
    expect(screen.getByRole('button', { name: /try again/i })).not.toBeNull()
    expect(screen.queryByTestId('stub-map')).toBeNull()
  })

  it('reloads the map when Try again is pressed', () => {
    render(
      <ApproximateLocationMapClient
        location={null}
        tone="self"
        interactive={false}
        pinnable={false}
      />,
    )
    expect(stubMapMounts).toBe(1)
    expect(screen.queryByTestId('stub-map')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(stubMapMounts).toBe(2)
    expect(screen.getByTestId('stub-map')).not.toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
