// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PollComposer, emptyPollDraft, type PollDraft } from '../../src/features/social/PollComposer'

afterEach(cleanup)

function StatefulComposer({ initial }: { initial: PollDraft }) {
  const [value, setValue] = useState(initial)
  return <PollComposer value={value} onChange={setValue} />
}

describe('PollComposer', () => {
  it('reports validation until the draft is complete', () => {
    render(<StatefulComposer initial={emptyPollDraft()} />)
    expect(screen.getByRole('alert').textContent).toContain('Poll question cannot be empty')
  })

  it('adds options up to four and removes them down to two', () => {
    render(<StatefulComposer initial={{ question: 'Pick one', options: ['A', 'B'] }} />)

    fireEvent.click(screen.getByRole('button', { name: /Add option/ }))
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: /Add option/ }))
    expect(screen.getAllByRole('textbox')).toHaveLength(5)
    expect((screen.getByRole('button', { name: /Add option/ }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Remove option 1' }))
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })
})
