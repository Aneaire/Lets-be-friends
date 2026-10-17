import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import {
  AcceptanceCheckboxes,
  AlreadyAcceptedNotice,
} from './PolicySummaries'

function TwoBoxDemo() {
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  return (
    <div className="onboarding-stage">
      <AcceptanceCheckboxes
        termsChecked={termsChecked}
        privacyChecked={privacyChecked}
        onTermsChange={setTermsChecked}
        onPrivacyChange={setPrivacyChecked}
      />
    </div>
  )
}

const meta = {
  title: 'Features/Policy/Unified acceptance',
  component: TwoBoxDemo,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta<typeof TwoBoxDemo>

export default meta
type Story = StoryObj<typeof meta>

export const TwoBoxes: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const termsBox = canvas.getByRole('checkbox', { name: /I agree to the Terms and Conditions/ })
    const privacyBox = canvas.getByRole('checkbox', { name: /I agree to the Privacy Policy/ })
    await expect(termsBox).not.toBeChecked()
    await expect(privacyBox).not.toBeChecked()

    const termsLink = canvas.getByRole('link', { name: 'Terms and Conditions' })
    const privacyLink = canvas.getByRole('link', { name: 'Privacy Policy' })
    expect(termsLink.getAttribute('href')).toBe('/terms-and-conditions')
    expect(termsLink.getAttribute('target')).toBe('_blank')
    expect(termsLink.getAttribute('rel')).toContain('noopener')
    expect(privacyLink.getAttribute('href')).toBe('/privacy-policy')
    expect(privacyLink.getAttribute('target')).toBe('_blank')

    // Either box alone is checkable; each toggles independently.
    await userEvent.click(termsBox)
    await expect(termsBox).toBeChecked()
    await expect(privacyBox).not.toBeChecked()

    // Clicking a document link never toggles its checkbox.
    await userEvent.click(privacyLink)
    await expect(privacyBox).not.toBeChecked()
    await userEvent.click(termsLink)
    await expect(termsBox).toBeChecked()

    await expect(canvas.queryByText(/rounded approximate location is stored/i)).toBeNull()
    await expect(canvas.queryByText(/for as long as your account exists/i)).toBeNull()
  },
}

export const Remembered: Story = {
  render: () => (
    <div className="onboarding-stage">
      <AlreadyAcceptedNotice />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/already accepted the current Terms/i)).toBeVisible()
    await expect(canvas.queryByRole('checkbox')).toBeNull()
    expect(canvas.getByRole('link', { name: 'Terms and Conditions' }).getAttribute('href')).toBe('/terms-and-conditions')
  },
}

export const Narrow: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('checkbox', { name: /I agree to the Privacy Policy/ })).toBeVisible()
    await expect(canvas.getByRole('link', { name: 'Privacy Policy' })).toBeVisible()
  },
}
