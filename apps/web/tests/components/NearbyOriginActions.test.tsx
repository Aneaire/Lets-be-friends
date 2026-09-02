// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NearbyOriginActions } from '../../src/features/discovery/NearbyOriginActions'

afterEach(cleanup)

describe('NearbyOriginActions', () => {
  it('marks pin placement as the selected search-origin mode', () => {
    const onUseCurrentLocation = vi.fn()
    const onBeginTravelPin = vi.fn()
    const { rerender } = render(
      <NearbyOriginActions
        originMode="custom"
        onUseCurrentLocation={onUseCurrentLocation}
        onBeginTravelPin={onBeginTravelPin}
      />,
    )

    const deviceButton = screen.getByRole('button', { name: 'Use my location' })
    const pinButton = screen.getByRole('button', { name: 'Place a pin' })
    expect(deviceButton.getAttribute('aria-pressed')).toBe('false')
    expect(deviceButton.classList.contains('btn-neutral')).toBe(true)
    expect(pinButton.getAttribute('aria-pressed')).toBe('true')
    expect(pinButton.classList.contains('btn-social')).toBe(true)

    fireEvent.click(pinButton)
    expect(onBeginTravelPin).toHaveBeenCalledOnce()

    rerender(
      <NearbyOriginActions
        originMode="device"
        onUseCurrentLocation={onUseCurrentLocation}
        onBeginTravelPin={onBeginTravelPin}
      />,
    )
    expect(deviceButton.getAttribute('aria-pressed')).toBe('true')
    expect(pinButton.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(deviceButton)
    expect(onUseCurrentLocation).toHaveBeenCalledOnce()
  })
})
