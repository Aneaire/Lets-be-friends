// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Id } from '../../convex/_generated/dataModel'

const mocks = vi.hoisted(() => ({
  queryResult: undefined as unknown,
}))

vi.mock('convex/react', () => ({
  useQuery: () => mocks.queryResult,
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
}))

import { EvidenceDecision, EvidenceDecisionView } from '../../src/features/booking/EvidenceDecision'

afterEach(() => {
  cleanup()
  mocks.queryResult = undefined
})

const props = {
  bookingId: 'booking-1' as Id<'bookings'>,
  label: 'End evidence',
  guidance: 'Optional and private guidance for the member.',
  skipWarning: 'Strict warning about skipping evidence.',
}

describe('EvidenceDecision', () => {
  it('hides the upload and skip controls while the evidence status query is loading', () => {
    render(<EvidenceDecision {...props} />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(/Loading evidence status/)).toBeTruthy()
    expect(screen.queryByText('Upload private image')).toBeNull()
    expect(screen.queryByText('Skip after warning')).toBeNull()
  })

  it('replaces the loading status with the compact saved presentation after an upload resolves', () => {
    const { rerender } = render(<EvidenceDecision {...props} />)
    expect(screen.getByText(/Loading evidence status/)).toBeTruthy()

    mocks.queryResult = { role: 'member_end', requiredBeforeCompletion: true, decision: 'uploaded' }
    rerender(<EvidenceDecision {...props} />)

    expect(screen.getByText(/Private image saved/)).toBeTruthy()
    expect(screen.queryByText(/Loading evidence status/)).toBeNull()
    expect(screen.queryByText('Upload private image')).toBeNull()
    expect(screen.queryByText('Skip after warning')).toBeNull()
  })

  it('replaces the loading status with the compact skipped presentation after a skip resolves', () => {
    const { rerender } = render(<EvidenceDecision {...props} />)
    expect(screen.getByText(/Loading evidence status/)).toBeTruthy()

    mocks.queryResult = { role: 'member_end', requiredBeforeCompletion: true, decision: 'skipped' }
    rerender(<EvidenceDecision {...props} />)

    expect(screen.getByText(/Skipped after warning acknowledgement/)).toBeTruthy()
    expect(screen.queryByText(/Loading evidence status/)).toBeNull()
    expect(screen.queryByText('Upload private image')).toBeNull()
    expect(screen.queryByText('Skip after warning')).toBeNull()
  })

  it('shows the decision controls only after the status query resolves with no decision', () => {
    const { rerender } = render(<EvidenceDecision {...props} />)
    expect(screen.queryByText('Upload private image')).toBeNull()
    expect(screen.queryByText('Skip after warning')).toBeNull()

    mocks.queryResult = { role: 'member_end', requiredBeforeCompletion: true, decision: undefined }
    rerender(<EvidenceDecision {...props} />)

    expect(screen.getByText('Upload private image')).toBeTruthy()
    expect(screen.getByText('Skip after warning')).toBeTruthy()
    expect(screen.queryByText(/Loading evidence status/)).toBeNull()
  })
})

describe('EvidenceDecisionView', () => {
  const viewProps = {
    label: 'Start evidence',
    guidance: 'Optional and private. The member cannot access it.',
    onUpload: vi.fn(),
    onSkip: vi.fn(),
  }

  it('announces the loading state without exposing decision controls', () => {
    render(<EvidenceDecisionView {...viewProps} state="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Loading evidence status')
    expect(screen.queryByText('Upload private image')).toBeNull()
  })

  it('shows the saved decision without exposing decision controls', () => {
    render(<EvidenceDecisionView {...viewProps} state="decided" decision="uploaded" />)
    expect(screen.getByText(/Private image saved/)).toBeTruthy()
    expect(screen.queryByText('Skip after warning')).toBeNull()
  })

  it('hands a chosen file to the upload handler and clears the input', () => {
    const onUpload = vi.fn()
    render(<EvidenceDecisionView {...viewProps} state="undecided" onUpload={onUpload} />)
    const file = new File(['image'], 'start.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    expect(onUpload).toHaveBeenCalledWith(file)
    expect(input.value).toBe('')
  })

  it('disables both decisions while a decision is processing', () => {
    render(<EvidenceDecisionView {...viewProps} state="undecided" busy />)
    expect(screen.getByText('Processing image…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip after warning' }).hasAttribute('disabled')).toBe(true)
    expect((document.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true)
  })

  it('surfaces the decision error next to the controls', () => {
    render(<EvidenceDecisionView {...viewProps} state="undecided" error="Evidence image could not be saved." />)
    expect(screen.getByText('Evidence image could not be saved.')).toBeTruthy()
  })
})
