import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { useRef, useState } from 'react'

import { BookingCompanionSearch } from './BookingCompanionSearch'
import { BookingDialogCompanionSummary, BookingDialogFrame, BookingDialogLayout } from './BookingDialogFrame'
import { BookingRequestFields } from './BookingRequestFields'
import { AvailabilityCalendar } from '../scheduling/AvailabilityCalendar'
import type { SchedulingMonth } from '../scheduling/scheduling'

// These stories render the exact presentational pieces `BookingDialog` uses
// (frame, layout, identity summary, calendar, request fields). The connected
// container only swaps real Convex queries in for the calendar month, so the
// browser assertions below cover the real modal chrome, not a hand-rolled copy.

const NOW = Date.UTC(2026, 9, 15, 2, 0)
const SLOT_0900 = Date.UTC(2026, 9, 20, 1, 0)
const SLOT_1030 = Date.UTC(2026, 9, 20, 2, 30)

const DAYS = [{ date: '2026-10-20', startsAt: [SLOT_0900, SLOT_1030] }]

// A deliberately huge intrinsic image proves the avatar CSS, not the asset,
// keeps the Companion photo bounded.
const LARGE_PROFILE_IMAGE = 'data:image/svg+xml,'
  + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000"><rect width="2000" height="2000" fill="#1093ED"/></svg>')

const SEARCH_COMPANIONS = [
  {
    _id: 'companion-dana',
    displayName: 'Dana Cruz',
    username: 'dana',
    city: 'Manila',
    strengths: ['Errands'],
    mode: 'both' as const,
    categories: ['Coffee and conversation', 'City walk'],
    profileImageUrl: LARGE_PROFILE_IMAGE,
  },
  {
    _id: 'companion-mina',
    displayName: 'Mina Santos',
    username: 'mina_s',
    city: 'Quezon City',
    strengths: ['Study sessions'],
    mode: 'online' as const,
    categories: ['Study session', 'Career practice'],
    profileImageUrl: LARGE_PROFILE_IMAGE,
  },
  {
    _id: 'companion-jules',
    displayName: 'Jules Rivera',
    username: 'jules',
    city: 'Makati',
    strengths: ['City walks'],
    mode: 'in_person' as const,
    categories: ['City walk', 'Coffee and conversation'],
    profileImageUrl: LARGE_PROFILE_IMAGE,
  },
]

const submit = fn()

function BookingCreationDialogStory() {
  const [open, setOpen] = useState(true)
  const [month, setMonth] = useState<SchedulingMonth>({ year: 2026, month: 9 })
  const [selectedStart, setSelectedStart] = useState<number | null>(null)
  const [category, setCategory] = useState('Coffee and conversation')
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [notes, setNotes] = useState('')

  if (!open) {
    return (
      <button type="button" className="btn btn-social" onClick={() => setOpen(true)}>
        Book a time
      </button>
    )
  }

  return (
    <BookingDialogFrame
      title="Book with Dana"
      onClose={() => setOpen(false)}
      describedById="booking-dialog-guidance"
      onBackdropMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <BookingDialogLayout
        calendar={(
          <AvailabilityCalendar
            month={month}
            onMonthChange={setMonth}
            days={DAYS}
            durationMinutes={durationMinutes}
            selectedStart={selectedStart}
            onSelectStart={setSelectedStart}
            now={NOW}
          />
        )}
        details={(
          <>
            <BookingDialogCompanionSummary
              displayName="Dana Cruz"
              username="dana"
              city="Manila"
              detail="Errands"
              profileImageUrl={LARGE_PROFILE_IMAGE}
            />
            <div className="booking-dialog-request">
              <BookingRequestFields
                category={category}
                categoryOptions={['Coffee and conversation', 'City walk']}
                onCategoryChange={setCategory}
                mode={mode}
                modeOptions={['online', 'in_person']}
                onModeChange={setMode}
                durationMinutes={durationMinutes}
                onDurationMinutesChange={setDurationMinutes}
                showScheduling={false}
                notes={notes}
                onNotesChange={setNotes}
                disabled={false}
              />
              <button type="submit" className="btn btn-social btn-block" disabled={selectedStart === null}>
                Send booking
              </button>
              <p className="text-tiny" id="booking-dialog-guidance">
                Bookings are available only after identity review is approved.
              </p>
            </div>
          </>
        )}
      />
    </BookingDialogFrame>
  )
}

function BookingSearchDialogStory() {
  const [open, setOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [category, setCategory] = useState('Coffee and conversation')
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [notes, setNotes] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  if (!open) {
    return (
      <button type="button" className="btn btn-social" onClick={() => setOpen(true)}>
        Book a time
      </button>
    )
  }

  return (
    <BookingDialogFrame
      title="Book a time"
      onClose={() => setOpen(false)}
      describedById="booking-dialog-guidance"
      onSubmit={(event) => event.preventDefault()}
    >
      <BookingCompanionSearch
        companions={SEARCH_COMPANIONS}
        loading={false}
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setSelected('')
        }}
        selectedCompanionProfileId={selected}
        onSelect={(companion) => {
          setSelected(companion._id)
          setQuery(companion.displayName)
          setSearchOpen(false)
        }}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        searchRef={searchRef}
      />
      <div className="booking-dialog-request">
        <BookingRequestFields
          category={category}
          categoryOptions={['Coffee and conversation', 'City walk']}
          onCategoryChange={setCategory}
          mode={mode}
          modeOptions={['online', 'in_person']}
          onModeChange={setMode}
          durationMinutes={durationMinutes}
          onDurationMinutesChange={setDurationMinutes}
          showScheduling={false}
          notes={notes}
          onNotesChange={setNotes}
          disabled={false}
        />
        <button type="submit" className="btn btn-social btn-block" disabled={!selected}>
          Send booking
        </button>
        <p className="text-tiny" id="booking-dialog-guidance">
          Bookings are available only after identity review is approved.
        </p>
      </div>
    </BookingDialogFrame>
  )
}

const meta = {
  title: 'Features/Booking/Creation dialog',
  component: BookingCreationDialogStory,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BookingCreationDialogStory>

export default meta
type Story = StoryObj<typeof meta>

// The centered frame eases in from `opacity: 0` and `scale(0.96)` for 200ms.
// Any visibility check or geometry measurement must therefore wait for that
// entry animation to finish, otherwise it observes a zero-opacity, inset frame.
async function settledDialog(canvasElement: HTMLElement) {
  const dialog = within(canvasElement).getByRole('dialog')
  await waitFor(() => expect(dialog).toBeVisible())
  await waitFor(() => expect(getComputedStyle(dialog).opacity).toBe('1'))
  return dialog
}

async function expectCalendarVisible(canvas: ReturnType<typeof within>) {
  const calendar = canvas.getByRole('region', { name: /availability calendar/i })
  await waitFor(() => expect(calendar).toBeVisible())
}

async function expectCenteredAndInViewport(dialog: HTMLElement) {
  const rect = dialog.getBoundingClientRect()
  const leftGap = rect.left
  const rightGap = window.innerWidth - rect.right
  // Balanced all-side gutters: roughly equal horizontal air on both sides.
  await expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2)
  await expect(leftGap).toBeGreaterThan(0)
  await expect(rightGap).toBeGreaterThan(0)
  // Bounded by the viewport on every edge, never taller than the window.
  await expect(rect.top).toBeGreaterThanOrEqual(-0.5)
  await expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight + 0.5)
  await expect(rect.height).toBeLessThanOrEqual(window.innerHeight)
  await expect(rect.width).toBeLessThanOrEqual(window.innerWidth)
}

export const CenteredDesktop: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = await settledDialog(canvasElement)
    await expectCalendarVisible(canvas)
    await expectCenteredAndInViewport(dialog)
  },
}

export const CenteredMobileSmall: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = await settledDialog(canvasElement)
    await expectCalendarVisible(canvas)
    await expectCenteredAndInViewport(dialog)
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth)
  },
}

export const CenteredMobileDefault: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = await settledDialog(canvasElement)
    await expectCalendarVisible(canvas)
    await expectCenteredAndInViewport(dialog)
    await expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth)
  },
}

export const HeaderStaysFixedAndBodyScrolls: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = await settledDialog(canvasElement)
    const header = dialog.querySelector<HTMLElement>('.booking-dialog-header')
    const body = dialog.querySelector<HTMLElement>('.booking-dialog-body')
    if (!header || !body) throw new Error('Expected the dialog header and scroll body')

    await expect(getComputedStyle(body).overflowY).toBe('auto')
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)

    const headerTopBeforeScroll = header.getBoundingClientRect().top
    body.scrollTop = body.scrollHeight
    await waitFor(() => expect(body.scrollTop).toBeGreaterThan(0))
    // The internal body scrolls while the header stays put.
    await expect(Math.abs(header.getBoundingClientRect().top - headerTopBeforeScroll)).toBeLessThanOrEqual(0.5)

    const send = canvas.getByRole('button', { name: 'Send booking' })
    send.scrollIntoView({ block: 'end' })
    const dialogRect = dialog.getBoundingClientRect()
    const sendRect = send.getBoundingClientRect()
    await expect(sendRect.top).toBeGreaterThanOrEqual(dialogRect.top - 1)
    await expect(sendRect.bottom).toBeLessThanOrEqual(dialogRect.bottom + 1)
  },
}

export const CompanionPhotoStaysBounded: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dialog = await settledDialog(canvasElement)
    const avatar = dialog.querySelector<HTMLElement>('.booking-companion-search-avatar')
    if (!avatar) throw new Error('Expected the Companion avatar')
    const rect = avatar.getBoundingClientRect()
    // Three rem square, regardless of the asset's intrinsic size.
    await expect(rect.width).toBeLessThanOrEqual(50)
    await expect(rect.height).toBeLessThanOrEqual(50)
    await expect(Math.abs(rect.width - rect.height)).toBeLessThanOrEqual(1)
    await expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth)
  },
}

export const ChooseDayAndStartTime: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await settledDialog(canvasElement)
    const send = canvas.getByRole('button', { name: 'Send booking' })
    await expect(send).toBeDisabled()

    await userEvent.click(canvas.getByRole('gridcell', { name: /Tuesday, October 20, 2026/ }))
    await userEvent.click(canvas.getByRole('button', { name: '9:00 AM, 1 hr session' }))

    await expect(canvas.getByRole('button', { name: '9:00 AM, 1 hr session' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(canvas.getByText(/^Selected /)).toBeVisible())
    await expect(send).toBeEnabled()
  },
}

export const CompanionSearchResults: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  render: () => <BookingSearchDialogStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await settledDialog(canvasElement)
    const search = canvas.getByLabelText('Search Companions')
    await userEvent.type(search, 'Dana')

    const results = canvas.getByRole('listbox', { name: 'Companion search results' })
    await expect(results).toBeVisible()
    await expect(canvas.getByRole('option', { name: /Dana Cruz/ })).toBeVisible()

    await userEvent.click(canvas.getByRole('option', { name: /Dana Cruz/ }))
    await expect(search).toHaveValue('Dana Cruz')
    await expect(canvas.queryByRole('listbox', { name: 'Companion search results' })).not.toBeInTheDocument()
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await settledDialog(canvasElement)
    await expectCalendarVisible(canvas)
  },
}
