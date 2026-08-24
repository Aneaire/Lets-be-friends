// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AttachmentMetaRow } from '../../src/design-system/molecules/AttachmentMetaRow'

afterEach(cleanup)

describe('AttachmentMetaRow', () => {
  it('renders its presentation slots and delegates the action', () => {
    const retry = vi.fn()
    const { container } = render(
      <AttachmentMetaRow
        leading={<span data-testid="file-leading">DOC</span>}
        name="booking-details.docx"
        detail="The upload connection was interrupted."
        state="Upload failed"
        stateTone="danger"
        action={<button type="button" onClick={retry}>Retry upload</button>}
      />,
    )

    expect(screen.getByTestId('file-leading')).toBeTruthy()
    expect(screen.getByText('booking-details.docx')).toBeTruthy()
    expect(screen.getByText('The upload connection was interrupted.')).toBeTruthy()
    expect(screen.getByText('Upload failed')).toBeTruthy()
    expect(container.firstElementChild?.getAttribute('data-state-tone')).toBe('danger')

    fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('supports a minimal metadata-only row without empty state or action content', () => {
    const { container } = render(<AttachmentMetaRow name="conversation-notes.pdf" className="custom-row" />)

    const row = container.firstElementChild
    expect(row?.classList.contains('ds-attachment-meta-row')).toBe(true)
    expect(row?.classList.contains('custom-row')).toBe(true)
    expect(row?.hasAttribute('data-state-tone')).toBe(false)
    expect(screen.getByText('conversation-notes.pdf')).toBeTruthy()
    expect(container.querySelector('.ds-attachment-meta-row-state')).toBeNull()
    expect(container.querySelector('.ds-attachment-meta-row-action')).toBeNull()
  })
})
