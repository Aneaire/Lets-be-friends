import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { Button } from '../../design-system/atoms/Button'
import { Textarea } from '../../design-system/atoms/Field'

function CompanionEditorLayoutFixture({ showBack = false }: { showBack?: boolean }) {
  return (
    <main style={{ width: '100%', padding: '1rem' }}>
      <div className="companion-page" data-editor="true">
        <div className="drawer-companion">
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

async function verifyMobileLayout(canvasElement: HTMLElement, showBack: boolean) {
  const canvas = within(canvasElement)
  const form = canvas.getByRole('form', { name: 'Companion profile layout preview' })
  const work = canvas.getByRole('textbox', { name: 'Work or skills' })
  const actions = canvas.getByRole('group', { name: 'Profile step actions' })
  const preview = canvas.getByRole('complementary', { name: 'Member profile preview' })
  const review = canvas.getByRole('complementary', { name: 'Review status preview' })
  const save = canvas.getByRole('button', { name: 'Save and continue' })
  const auxiliaryLabel = canvas.getByText('required, 40 to 500 characters')

  const workBox = work.getBoundingClientRect()
  const actionsBox = actions.getBoundingClientRect()
  const formBox = form.getBoundingClientRect()
  const previewBox = preview.getBoundingClientRect()
  const reviewBox = review.getBoundingClientRect()
  const saveBox = save.getBoundingClientRect()

  await expect(getComputedStyle(actions).position).toBe('static')
  await expect(getComputedStyle(auxiliaryLabel).display).toBe('block')
  await expect(actionsBox.top).toBeGreaterThanOrEqual(workBox.bottom)
  await expect(Math.abs(formBox.bottom - actionsBox.bottom)).toBeLessThanOrEqual(2)
  await expect(previewBox.top - formBox.bottom).toBeGreaterThanOrEqual(20)
  await expect(previewBox.top - formBox.bottom).toBeLessThanOrEqual(28)
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
