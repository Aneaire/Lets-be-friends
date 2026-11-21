import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, within } from 'storybook/test'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { OnboardingActionRow } from './OnboardingActionRow'

const meta = {
  title: 'Features/Onboarding/Action row',
  component: OnboardingActionRow,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    showBack: true,
    backDisabled: false,
    onBack: fn(),
    primary: <ActionButton label="Continue" onPress={() => undefined} intent="self" />,
  },
} satisfies Meta<typeof OnboardingActionRow>

export default meta
type Story = StoryObj<typeof meta>

export const LaterStep: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Go to previous step' })).toBeVisible()
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeVisible()
  },
}

export const FirstStep: Story = {
  args: { showBack: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Go to previous step' })).toBeNull()
    await expect(canvas.getByRole('button', { name: 'Continue' })).toBeVisible()
  },
}

export const Narrow: Story = {
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
}
