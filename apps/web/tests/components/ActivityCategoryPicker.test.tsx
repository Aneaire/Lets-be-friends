// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activityCategories } from '@lets-be-friends/shared'
import { ActivityCategoryPicker } from '../../src/features/companion-application/ActivityCategoryPicker'

const observerHarness = vi.hoisted(() => ({
  inView: false,
  options: [] as Array<{ root?: unknown; skip?: boolean; rootMargin?: string }>,
}))

vi.mock('react-intersection-observer', () => ({
  useInView: (options?: { root?: unknown; skip?: boolean; rootMargin?: string }) => {
    observerHarness.options.push(options ?? {})
    return { ref: () => {}, inView: observerHarness.inView }
  },
}))

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

beforeEach(() => {
  observerHarness.inView = false
  observerHarness.options = []
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  observerHarness.inView = false
  observerHarness.options = []
  document.body.style.overflow = ''
})

function openBrowser() {
  fireEvent.click(screen.getByRole('button', { name: 'Browse categories' }))
  expect(screen.getByRole('dialog', { name: 'Browse activity categories' })).toBeTruthy()
}

function searchFor(value: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search activity categories' }), {
    target: { value },
  })
}

function matchingCount(query: string) {
  const normalized = query.trim().toLocaleLowerCase()
  return activityCategories.filter((value) => value.toLocaleLowerCase().includes(normalized)).length
}

describe('ActivityCategoryPicker', () => {
  it('keeps the browser closed until requested, then shows the first page', () => {
    render(<Picker />)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('No activities selected yet.')).toBeTruthy()

    openBrowser()

    expect(screen.getByRole('searchbox', { name: 'Search activity categories' })).toBeTruthy()
    expect(screen.getByText('51 categories found')).toBeTruthy()
    expect(screen.getByText('Showing 12 of 51')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Load more categories' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Religious and community activities' })).toBeNull()
  })

  it('pages through the full list with the fallback button', () => {
    render(<Picker />)
    openBrowser()

    fireEvent.click(screen.getByRole('button', { name: 'Load more categories' }))
    expect(screen.getByText('Showing 24 of 51')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Load more categories' }))
    expect(screen.getByText('Showing 36 of 51')).toBeTruthy()
    expect(screen.getByRole('button', { name: activityCategories[30] })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Load more categories' }))
    fireEvent.click(screen.getByRole('button', { name: 'Load more categories' }))
    expect(screen.getByText('Showing all 51 categories')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Religious and community activities' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Load more categories' })).toBeNull()
  })

  it('observes the dialog scroll root and fills pages while the sentinel is in view', () => {
    const { rerender } = render(<Picker />)
    openBrowser()

    const scroll = screen.getByTestId('category-browser-scroll')
    const observed = observerHarness.options.filter((option) => option.skip === false)
    expect(observed.length).toBeGreaterThan(0)
    expect(observed[observed.length - 1].root).toBe(scroll)
    expect(observed[observed.length - 1].rootMargin).toBe('0px 0px 80px')
    expect(screen.getByText('Showing 12 of 51')).toBeTruthy()

    observerHarness.inView = true
    rerender(<Picker />)

    expect(screen.getByText('Showing all 51 categories')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Load more categories' })).toBeNull()
    expect(observerHarness.options[observerHarness.options.length - 1].skip).toBe(true)
  })

  it('searches the dialog list and pages through searched batches', () => {
    render(<Picker initial={['Good company']} />)
    openBrowser()

    searchFor('and')
    const expected = matchingCount('and')
    expect(expected).toBeGreaterThan(12)
    expect(screen.getByText(`${expected} categories found`)).toBeTruthy()
    expect(screen.getByText(`Showing 12 of ${expected}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Load more categories' }))
    expect(screen.getByText(`Showing all ${expected} categories`)).toBeTruthy()

    searchFor('tech')
    expect(screen.getByText('1 category found')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tech help' })).toBeTruthy()
    expect(screen.getByText('Showing all 1 categories')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Load more categories' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove Good company' })).toBeTruthy()
  })

  it('shows an empty state with a working search reset', () => {
    render(<Picker />)
    openBrowser()

    searchFor('zzz no such activity')
    expect(screen.getByText('No matching activities')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Load more categories' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reset search' }))
    expect(screen.getByText('51 categories found')).toBeTruthy()
    expect(screen.getByText('Showing 12 of 51')).toBeTruthy()
  })

  it('resets the dialog scroll position when the search changes', () => {
    render(<Picker />)
    openBrowser()

    const scroll = screen.getByTestId('category-browser-scroll')
    scroll.scrollTop = 200
    expect(scroll.scrollTop).toBe(200)

    searchFor('tech')
    expect(scroll.scrollTop).toBe(0)
  })

  it('keeps selections in sync between the dialog and the removable chips', () => {
    render(<Picker initial={['Good company']} />)
    expect(screen.getByText('1 of 10 selected')).toBeTruthy()

    openBrowser()
    expect(screen.getByRole('button', { name: 'Good company' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Good company' }))
    expect(screen.getByText('0 of 10 selected')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove Good company' })).toBeNull()
    expect(screen.getByText('No activities selected yet.')).toBeTruthy()

    searchFor('tech')
    fireEvent.click(screen.getByRole('button', { name: 'Tech help' }))
    expect(screen.getByText('1 of 10 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove Tech help' })).toBeTruthy()
  })

  it('enforces the selection limit while still allowing removal', () => {
    render(<Picker initial={activityCategories.slice(0, 10)} />)
    expect(screen.getByText('10 of 10 selected')).toBeTruthy()
    expect(screen.getByText(/selected the maximum of 10 activities/)).toBeTruthy()

    openBrowser()
    expect(screen.getByRole('button', { name: 'Home organization' })).toHaveProperty('disabled', true)

    const selectedOption = screen.getByRole('button', { name: activityCategories[0] })
    expect(selectedOption).toHaveProperty('disabled', false)
    fireEvent.click(selectedOption)
    expect(screen.getByText('9 of 10 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Home organization' })).toHaveProperty('disabled', false)

    fireEvent.click(screen.getByRole('button', { name: `Remove ${activityCategories[1]}` }))
    expect(screen.getByText('8 of 10 selected')).toBeTruthy()
  })

  it('validates custom categories before adding them', () => {
    render(<Picker initial={['Good company']} />)
    const customInput = screen.getByPlaceholderText('For example, museum visits')

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByText('Enter a category.')).toBeTruthy()

    fireEvent.change(customInput, { target: { value: 'good company' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByText('Choose each category only once.')).toBeTruthy()

    fireEvent.change(customInput, { target: { value: 'Museum visits' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByText('2 of 10 selected')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove Museum visits' })).toBeTruthy()
  })

  it('closes with Done or Escape and restores focus to the browse button', () => {
    render(<Picker />)
    const browse = screen.getByRole('button', { name: 'Browse categories' })
    browse.focus()
    fireEvent.click(browse)
    expect(screen.getByRole('dialog', { name: 'Browse activity categories' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(browse)

    fireEvent.click(browse)
    expect(screen.getByRole('dialog', { name: 'Browse activity categories' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search activity categories' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(browse)
  })

  it('resets search and paging when the browser is reopened', () => {
    render(<Picker />)
    openBrowser()

    searchFor('tech')
    expect(screen.getByText('1 category found')).toBeTruthy()
    const scroll = screen.getByTestId('category-browser-scroll')
    scroll.scrollTop = 120

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    openBrowser()

    expect(screen.getByRole('searchbox', { name: 'Search activity categories' })).toHaveProperty('value', '')
    expect(screen.getByText('51 categories found')).toBeTruthy()
    expect(screen.getByText('Showing 12 of 51')).toBeTruthy()
    expect(screen.getByTestId('category-browser-scroll').scrollTop).toBe(0)
  })
})
