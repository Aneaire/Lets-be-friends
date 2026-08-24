import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { CompanionFinancePresentation } from './CompanionFinancePresentation'

const goBack = fn()

const obligations = [
  {
    id: 'obligation-1',
    amountLabel: '₱180.00',
    detail: 'Due Aug 29, 2026 · ₱0.00 paid',
    feeLabel: '15% fee',
    pastDue: false,
  },
]

const ledger = [
  {
    id: 'ledger-1',
    label: 'Booking commission',
    detail: 'Aug 22, 2026, 6:30 PM',
    value: '+₱180.00',
  },
  {
    id: 'ledger-2',
    label: 'Fee payment',
    detail: 'Aug 16, 2026, 10:12 AM',
    value: '-₱120.00',
  },
]

const meta = {
  title: 'Mobile/Finance/Companion finance',
  component: CompanionFinancePresentation,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  args: {
    canAcceptBookings: true,
    availableEarnings: '₱3,420.00',
    pendingEarnings: '₱800.00',
    platformFeeBalance: '₱240.00',
    dueThisSaturday: '₱180.00',
    dueDateLabel: 'Aug 29, 2026',
    pastDue: '₱0.00',
    hasPastDue: false,
    payoutNotice: 'Payouts are handled outside the member app while account verification is completed.',
    obligations,
    ledger,
    onBack: goBack,
  },
} satisfies Meta<typeof CompanionFinancePresentation>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Eligible to accept bookings')).toBeVisible()
    await expect(canvas.getByText('₱3,420.00')).toBeVisible()
    await expect(canvas.getByText('Booking commission')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Go back' }))
    await expect(goBack).toHaveBeenCalledOnce()
  },
}

export const EmptyActivity: Story = {
  args: { obligations: [], ledger: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No open platform fee obligations.')).toBeVisible()
    await expect(canvas.getByText('No platform fee ledger entries.')).toBeVisible()
  },
}

export const BookingAcceptancePaused: Story = {
  args: {
    canAcceptBookings: false,
    pastDue: '₱2,480.00',
    hasPastDue: true,
    obligations: [
      {
        id: 'past-due-1',
        amountLabel: '₱2,480.00',
        detail: 'Due Aug 15, 2026 · ₱0.00 paid',
        feeLabel: '15% fee',
        pastDue: true,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const alert = within(canvasElement).getByRole('alert')
    await expect(alert).toHaveTextContent('Booking acceptance paused')
    await expect(alert).toHaveTextContent('Resolve past-due platform fees')
  },
}

export const LargeValuesAt320: Story = {
  parameters: { viewport: { defaultViewport: 'mobileTiny' } },
  args: {
    availableEarnings: '₱9,999,999.99',
    pendingEarnings: '₱888,888.88',
    platformFeeBalance: '₱777,777.77',
    dueThisSaturday: '₱666,666.66',
    pastDue: '₱555,555.55',
    payoutNotice: 'Payout review is still in progress because the latest account verification could not be completed automatically. Your recorded balances remain read-only.',
    obligations: [
      {
        id: 'long-obligation',
        amountLabel: '₱555,555.55',
        detail: 'Due Sunday, August 15, 2026 · ₱123,456.78 already recorded as paid',
        feeLabel: '15% platform fee',
        pastDue: true,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    )
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}
