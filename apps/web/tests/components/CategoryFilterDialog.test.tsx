// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryFilterDialog } from '../../src/features/discovery/CategoryFilterDialog'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.style.overflow = ''
})

const categories = ['Good company', 'Coffee and meals', 'Museum visits']

function Example({ onClose = vi.fn() }: { onClose?: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <CategoryFilterDialog
      open
      categories={categories}
      selectedCategory={selected}
      resultCount={selected ? 2 : 8}
      onChange={setSelected}
      onClose={onClose}
    />
  )
}

describe('CategoryFilterDialog', () => {
  it('keeps the category list inside a searchable dialog', () => {
    render(<Example />)

    expect(screen.getByRole('dialog', { name: 'What would you like to do?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Everything' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('3 categories')).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search categories' }), {
      target: { value: 'museum' },
    })

    expect(screen.getByRole('button', { name: 'Museum visits' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Good company' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Everything' })).toBeNull()
    expect(screen.getByText('1 category')).toBeTruthy()
  })

  it('selects one category, clears it, and reports the filtered result count', () => {
    render(<Example />)

    fireEvent.click(screen.getByRole('button', { name: 'Museum visits' }))
    expect(screen.getByRole('button', { name: 'Museum visits' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Show 2 results' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'Everything' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Show 8 results' })).toBeTruthy()
  })

  it('shows a useful empty search state and closes from the result action', () => {
    const onClose = vi.fn()
    render(<Example onClose={onClose} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search categories' }), {
      target: { value: 'woodworking' },
    })
    expect(screen.getByText('No categories match that search.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Reset search' }))
    expect(screen.getByRole('button', { name: 'Good company' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show 8 results' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
