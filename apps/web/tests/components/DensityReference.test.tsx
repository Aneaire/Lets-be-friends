// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DensityReference } from '../../src/design-system/foundations/Density.stories'

afterEach(cleanup)

describe('density action sample', () => {
  it('groups all three actions in the equal-width compact layout', () => {
    render(<DensityReference />)

    const group = screen.getByLabelText('Action density examples')
    const actions = screen.getAllByRole('button')

    expect(group.classList.contains('density-action-grid')).toBe(true)
    expect(actions.map((action) => action.textContent)).toEqual([
      'Self action',
      'Social action',
      'Neutral action',
    ])
  })
})
