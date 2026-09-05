// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { activityCategories } from '@lets-be-friends/shared'
import { ActivityCategoryPicker } from '../../src/features/companion-application/ActivityCategoryPicker'

function Picker({ initial = [] }: { initial?: string[] }) {
  const [selected, setSelected] = useState(initial)
  return (
    <ActivityCategoryPicker
      values={activityCategories}
      selected={selected}
      setSelected={setSelected}
      maximum={10}
    />
  )
}

describe('ActivityCategoryPicker', () => {
  it('shows a limited category set and reveals more on request', () => {
    render(<Picker />)

    expect(screen.getByText('Showing 12 of 51')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Religious and community activities' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Show more/ }))

    expect(screen.getByText('Showing 24 of 51')).toBeTruthy()
  })

  it('searches all categories and keeps selected activities separate', () => {
    render(<Picker initial={['Good company']} />)

    expect(screen.getByText('1 of 10 selected')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Search activities'), { target: { value: 'tech' } })

    expect(screen.getByRole('button', { name: 'Tech help' })).toBeTruthy()
    expect(screen.getByText('1 found')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Good company' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('enforces the selection limit and allows a selected activity to be removed', () => {
    render(<Picker initial={activityCategories.slice(0, 10)} />)

    expect(screen.getByText('10 of 10 selected')).toBeTruthy()
    expect(screen.getByText(/selected the maximum of 10 activities/)).toBeTruthy()
    expect(screen.getAllByRole('button', { pressed: false })[0]).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: activityCategories[0] }))

    expect(screen.getByText('9 of 10 selected')).toBeTruthy()
  })
})
