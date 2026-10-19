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

import {
  EvidenceDecision,
  EvidenceDecisionView,
  evidenceSkipWarning,
  type EvidenceRow,
} from '../../src/features/booking/EvidenceDecision'

afterEach(() => {
  cleanup()
  mocks.queryResult = undefined
})

const bookingId = 'booking-1' as Id<'bookings'>

describe('EvidenceDecision', () => {
  it('hides the record and the controls while the evidence status query is loading', () => {
    render(<EvidenceDecision bookingId={bookingId} />)

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText(/Loading evidence status/)).toBeTruthy()
    expect(screen.queryByText('Start evidence')).toBeNull()
    expect(screen.queryByText('Upload private image')).toBeNull()
    expect(screen.queryByText('Skip after warning')).toBeNull()
  })

  it('lists the start and end rows for the Companion, marking which row is theirs', () => {
    mocks.queryResult = {
      role: 'companion_start',
      requiredBeforeCompletion: true,
      decision: undefined,
      rows: [
        { role: 'companion_start', isViewer: true },
        { role: 'member_end', isViewer: false, decision: 'uploaded' },
      ],
    }
    render(<EvidenceDecision bookingId={bookingId} />)

    expect(screen.getByText('Start evidence')).toBeTruthy()
    expect(screen.getByText('End evidence')).toBeTruthy()
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('The member')).toBeTruthy()
    expect(screen.getByText('Private image saved')).toBeTruthy()
    expect(screen.getByText('Not decided yet')).toBeTruthy()
    expect(screen.getByText('Upload private image')).toBeTruthy()
  })

  it('lists the start and end rows for the member with their own row actionable', () => {
    mocks.queryResult = {
      role: 'member_end',
      requiredBeforeCompletion: true,
      decision: undefined,
      rows: [
        { role: 'companion_start', isViewer: false, decision: 'skipped' },
        { role: 'member_end', isViewer: true },
      ],
    }
    render(<EvidenceDecision bookingId={bookingId} />)

    expect(screen.getByText('The Companion')).toBeTruthy()
    expect(screen.getByText('Skipped after warning')).toBeTruthy()
    expect(screen.getByText('Upload private image')).toBeTruthy()
  })

  it('drops the controls once the viewer has made their own decision', () => {
    mocks.queryResult = {
      role: 'companion_start',
      requiredBeforeCompletion: true,
      decision: 'uploaded',
      rows: [
        { role: 'companion_start', isViewer: true, decision: 'uploaded' },
        { role: 'member_end', isViewer: false },
      ],
    }
    render(<EvidenceDecision bookingId={bookingId} />)

    expect(screen.getByText('Private image saved')).toBeTruthy()
    expect(screen.getByText('Not decided yet')).toBeTruthy()
    expect(screen.queryByText('Upload private image')).toBeNull()
    expect(screen.queryByText('Skip after warning')).toBeNull()
    expect(screen.queryByText(/Loading evidence status/)).toBeNull()
  })
})

describe('EvidenceDecisionView', () => {
  const rows: EvidenceRow[] = [
    { role: 'companion_start', isViewer: true },
    { role: 'member_end', isViewer: false, decision: 'uploaded' },
  ]
  const viewProps = {
    rows,
    onUpload: vi.fn(),
    onSkip: vi.fn(),
  }

  it('announces the loading state without exposing decision controls', () => {
    render(<EvidenceDecisionView {...viewProps} rows={[]} state="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Loading evidence status')
    expect(screen.queryByText('Upload private image')).toBeNull()
  })

  it('shows both rows without decision controls once the viewer decided', () => {
    render(
      <EvidenceDecisionView
        {...viewProps}
        state="decided"
        rows={[
          { role: 'companion_start', isViewer: true, decision: 'skipped' },
          { role: 'member_end', isViewer: false, decision: 'uploaded' },
        ]}
      />,
    )
    expect(screen.getByText('Skipped after warning')).toBeTruthy()
    expect(screen.getByText('Private image saved')).toBeTruthy()
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
    expect(screen.getByRole('alert').textContent).toContain('Evidence image could not be saved.')
  })

  it('keeps a truthful skip warning for each role', () => {
    expect(evidenceSkipWarning('companion_start')).toContain('start image')
    expect(evidenceSkipWarning('member_end')).toContain('end image')
  })
})
