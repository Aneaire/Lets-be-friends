import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Calendar } from '../components/Calendar'

export const Route = createFileRoute('/calendar-demo')({
  component: CalendarDemo,
})

function CalendarDemo() {
  const [date, setDate] = useState<Date | null>(new Date())
  const [pinkDate, setPinkDate] = useState<string>('')
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1.5rem' }}>
      <p className="eyebrow">Component demo</p>
      <h1 className="text-h1 mt-2">Calendar</h1>
      <p className="lede mt-3">
        Reusable popover calendar. First is the self (blue) variant, second is the social (pink) booking variant.
      </p>

      <label className="field-row mt-8">
        <span className="label">Pick a day <span className="label-aux">self variant</span></span>
        <Calendar value={date} onChange={setDate} />
      </label>

      <label className="field-row mt-8">
        <span className="label">When <span className="label-aux">social variant</span></span>
        <Calendar value={pinkDate} onChange={(value) => setPinkDate(value.toISOString())} variant="social" min={new Date()} />
      </label>
    </div>
  )
}