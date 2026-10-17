import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { Button } from '../../design-system/atoms/Button'
import { Textarea } from '../../design-system/atoms/Field'
import { WeeklyAvailabilityEditor } from '../scheduling/WeeklyAvailabilityEditor'

// The route only shows the availability panel once a profile is saved. The
// layout fixture mirrors that real structure so stories exercise the primary
// column that groups the profile form and the weekly availability card.
const saveAvailability = fn(async () => undefined)

const initialAvailability = [
  { weekday: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 },
  { weekday: 1, startMinutes: 13 * 60, endMinutes: 17 * 60 },
  { weekday: 3, startMinutes: 10 * 60, endMinutes: 15 * 60 },
]

function CompanionEditorLayoutFixture({ showBack = false }: { showBack?: boolean }) {
  return (
    <main style={{ width: '100%', padding: '1rem' }}>
      <div className="companion-page" data-editor="true">
        <div className="drawer-companion">
          <div className="companion-editor-primary">
            <form className="companion-editor-form" aria-label="Companion profile layout preview">
              <section className="numbered-section companion-editor-step" data-companion-step="1">
                <span className="numbered-section-marker tabular">1</span>
                <div className="numbered-section-body">
                  <header>
                    <h2 className="text-h2">What you offer</h2>
                  </header>
                  <label className="field-row">
                    <span className="label">Tell me about yourself (Bio) <span className="label-aux">required, up to 500 characters</span></span>
                    <Textarea defaultValue="I make everyday errands easier and enjoy helping members learn new things." className="min-h-24" />
                  </label>
                  <label className="field-row">
                    <span className="label">What work or skills could you share? <span className="label-aux">required, 40 to 500 characters</span></span>
                    <Textarea aria-label="Work or skills" defaultValue="I can help with everyday technology and enjoy unhurried conversations." className="min-h-28" />
                  </label>
                </div>
              </section>
              <div className="companion-editor-actions" role="group" aria-label="Profile step actions">
                {showBack ? <Button intent="neutral">Back</Button> : null}
                <Button intent="self">Save and continue</Button>
              </div>
            </form>

            <section className="companion-availability-panel" id="companion-availability" aria-labelledby="companion-layout-availability-title">
              <header className="companion-availability-head">
                <div>
                  <p className="eyebrow">Booking windows</p>
                  <h2 id="companion-layout-availability-title" className="text-h2">Weekly availability</h2>
                  <p className="text-meta mt-1">Choose when members can request a session. This saves separately from your profile details.</p>
                </div>
              </header>
              <WeeklyAvailabilityEditor initialAvailability={initialAvailability} onSave={saveAvailability} />
            </section>
          </div>

          <div className="companion-editor-aside">
            <aside className="companion-profile-preview" aria-label="Member profile preview">
              <div className="companion-preview-label"><span>Member preview</span><span>Updates as you type</span></div>
              <p className="companion-preview-intro">Your profile preview follows the editor.</p>
            </aside>
            <aside className="companion-profile-preview" aria-label="Review status preview">
              <strong>Review status</strong>
            </aside>
          </div>
        </div>
      </div>
    </main>
  )
}

function getPrimary(canvasElement: HTMLElement) {
  const primary = canvasElement.querySelector<HTMLElement>('.companion-editor-primary')
  if (!primary) throw new Error('The primary editor column was not rendered.')
  return primary
}

function getAvailability(canvasElement: HTMLElement) {
  const availability = canvasElement.querySelector<HTMLElement>('.companion-availability-panel')
  if (!availability) throw new Error('The weekly availability panel was not rendered.')
  return availability
}

function getAside(canvasElement: HTMLElement) {
  const aside = canvasElement.querySelector<HTMLElement>('.companion-editor-aside')
  if (!aside) throw new Error('The editor aside was not rendered.')
  return aside
}

async function verifyWideLayout(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const primary = getPrimary(canvasElement)
  const availability = getAvailability(canvasElement)
  const aside = getAside(canvasElement)
  const form = canvas.getByRole('form', { name: 'Companion profile layout preview' })

  // The profile form and the availability card share one primary column.
  await expect(primary.contains(form)).toBe(true)
  await expect(primary.contains(availability)).toBe(true)
  await expect(primary.contains(aside)).toBe(false)

  const primaryBox = primary.getBoundingClientRect()
  const formBox = form.getBoundingClientRect()
  const availabilityBox = availability.getBoundingClientRect()
  const asideBox = aside.getBoundingClientRect()

  // Equal width and left edge prove the availability card matches the form,
  // instead of stretching across the whole drawer at wide viewports.
  await expect(Math.abs(formBox.width - availabilityBox.width)).toBeLessThanOrEqual(1)
  await expect(Math.abs(formBox.left - availabilityBox.left)).toBeLessThanOrEqual(1)
  await expect(availabilityBox.right).toBeLessThanOrEqual(asideBox.left)
  await expect(formBox.right).toBeLessThanOrEqual(asideBox.left)

  // Stacked with the shared primary-column gap.
  await expect(availabilityBox.top - formBox.bottom).toBeGreaterThanOrEqual(20)
  await expect(availabilityBox.top - formBox.bottom).toBeLessThanOrEqual(28)

  // The aside sits beside the primary column and stays top aligned with it.
  await expect(asideBox.left).toBeGreaterThan(primaryBox.right)
  await expect(Math.abs(asideBox.top - primaryBox.top)).toBeLessThanOrEqual(2)

  await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
}

async function verifyStackedLayout(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  const primary = getPrimary(canvasElement)
  const availability = getAvailability(canvasElement)
  const form = canvas.getByRole('form', { name: 'Companion profile layout preview' })

  const primaryBox = primary.getBoundingClientRect()
  const formBox = form.getBoundingClientRect()
  const availabilityBox = availability.getBoundingClientRect()

  await expect(Math.abs(formBox.width - availabilityBox.width)).toBeLessThanOrEqual(1)
  await expect(availabilityBox.top - formBox.bottom).toBeGreaterThanOrEqual(20)
  await expect(availabilityBox.top - formBox.bottom).toBeLessThanOrEqual(28)

  // The paired aside cards wait below the entire primary column.
  const preview = canvas.getByRole('complementary', { name: 'Member profile preview' })
  const review = canvas.getByRole('complementary', { name: 'Review status preview' })
  const previewBox = preview.getBoundingClientRect()
  const reviewBox = review.getBoundingClientRect()

  await expect(previewBox.top - primaryBox.bottom).toBeGreaterThanOrEqual(20)
  await expect(previewBox.top - primaryBox.bottom).toBeLessThanOrEqual(28)
  await expect(Math.abs(previewBox.top - reviewBox.top)).toBeLessThanOrEqual(2)

  await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)
}

async function verifyMobileLayout(canvasElement: HTMLElement, showBack: boolean) {
  const canvas = within(canvasElement)
  const form = canvas.getByRole('form', { name: 'Companion profile layout preview' })
  const work = canvas.getByRole('textbox', { name: 'Work or skills' })
  const actions = canvas.getByRole('group', { name: 'Profile step actions' })
  const primary = getPrimary(canvasElement)
  const availability = getAvailability(canvasElement)
  const preview = canvas.getByRole('complementary', { name: 'Member profile preview' })
  const review = canvas.getByRole('complementary', { name: 'Review status preview' })
  const save = canvas.getByRole('button', { name: 'Save and continue' })
  const auxiliaryLabel = canvas.getByText('required, 40 to 500 characters')

  const workBox = work.getBoundingClientRect()
  const actionsBox = actions.getBoundingClientRect()
  const formBox = form.getBoundingClientRect()
  const primaryBox = primary.getBoundingClientRect()
  const availabilityBox = availability.getBoundingClientRect()
  const previewBox = preview.getBoundingClientRect()
  const reviewBox = review.getBoundingClientRect()
  const saveBox = save.getBoundingClientRect()

  await expect(getComputedStyle(actions).position).toBe('static')
  await expect(getComputedStyle(auxiliaryLabel).display).toBe('block')
  await expect(actionsBox.top).toBeGreaterThanOrEqual(workBox.bottom)
  await expect(Math.abs(formBox.bottom - actionsBox.bottom)).toBeLessThanOrEqual(2)
  // The grouped form and availability card keep matching widths when stacked.
  await expect(Math.abs(formBox.width - availabilityBox.width)).toBeLessThanOrEqual(1)
  await expect(availabilityBox.top - formBox.bottom).toBeGreaterThanOrEqual(20)
  await expect(availabilityBox.top - formBox.bottom).toBeLessThanOrEqual(28)
  await expect(previewBox.top - primaryBox.bottom).toBeGreaterThanOrEqual(20)
  await expect(previewBox.top - primaryBox.bottom).toBeLessThanOrEqual(28)
  await expect(reviewBox.top - previewBox.bottom).toBeGreaterThanOrEqual(14)
  await expect(reviewBox.top - previewBox.bottom).toBeLessThanOrEqual(18)
  await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth)

  if (showBack) {
    const back = canvas.getByRole('button', { name: 'Back' })
    const backBox = back.getBoundingClientRect()
    await expect(backBox.right).toBeLessThanOrEqual(saveBox.left)
    await expect(back.scrollWidth).toBeLessThanOrEqual(back.clientWidth)
    await expect(save.scrollWidth).toBeLessThanOrEqual(save.clientWidth)
  } else {
    await expect(saveBox.width).toBeGreaterThan(actionsBox.width * 0.8)
  }
}

const meta = {
  title: 'Web/Features/Companion application/Editor mobile layout',
  component: CompanionEditorLayoutFixture,
  parameters: { layout: 'fullscreen' },
  args: { showBack: false },
} satisfies Meta<typeof CompanionEditorLayoutFixture>

export default meta
type Story = StoryObj<typeof meta>

export const GroupedPrimaryColumnAtDesktop: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => verifyWideLayout(canvasElement),
}

export const StackedPrimaryColumnAtTablet: Story = {
  globals: { viewport: { value: 'tablet', isRotated: false } },
  play: async ({ canvasElement }) => verifyStackedLayout(canvasElement),
}

export const FirstStepAt320: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => verifyMobileLayout(canvasElement, false),
}

export const LaterStepAt390: Story = {
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: { showBack: true },
  play: async ({ canvasElement }) => verifyMobileLayout(canvasElement, true),
}

export const LaterStepAt430: Story = {
  globals: { viewport: { value: 'mobileLarge', isRotated: false } },
  args: { showBack: true },
  play: async ({ canvasElement }) => verifyMobileLayout(canvasElement, true),
}
