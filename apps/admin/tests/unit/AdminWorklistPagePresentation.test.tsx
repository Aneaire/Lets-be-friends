// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminWorklistPagePresentation } from '../../src/design-system/templates/AdminWorklistPagePresentation'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('admin worklist page presentation', () => {
  it('keeps long details and review actions in a dialog opened from the summary card', () => {
    const record = {
      id: 'application-1',
      name: 'Aurelia Buena',
      summary: 'Taytay · Online and in-person · Pending review',
      biography: 'A patient applicant who loves the lakeside mornings.',
    }

    render(
      <AdminWorklistPagePresentation
        eyebrow="Safety review"
        title="Companion profile reviews"
        rows={[record]}
        getKey={(row) => row.id}
        getDialogTitle={(row) => row.name}
        getDialogDescription={(row) => row.summary}
        renderSummary={(row) => (
          <>
            <span className="admin-worklist-title">{row.name}</span>
            <span>{row.summary}</span>
          </>
        )}
        renderDetails={(row) => <p>{row.biography}</p>}
        renderDialogActions={() => (
          <>
            <button type="button">Approve</button>
            <button type="button">Reject</button>
          </>
        )}
        loading="Loading reviews..."
        empty="No reviews."
        ariaLabel="Companion profile reviews"
      />,
    )

    const worklist = screen.getByRole('region', { name: 'Companion profile reviews' })
    expect(within(worklist).getByText('Aurelia Buena')).toBeTruthy()
    expect(within(worklist).queryByText(record.biography)).toBeNull()
    expect(within(worklist).queryByRole('button', { name: 'Approve' })).toBeNull()

    const card = within(worklist).getByRole('button', { name: /Aurelia Buena/ })
    fireEvent.click(card)

    const dialog = screen.getByRole('dialog', { name: 'Aurelia Buena' })
    expect(within(dialog).getByText(record.biography)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Approve' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Reject' })).toBeTruthy()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Aurelia Buena' })).toBeNull()
  })
})
