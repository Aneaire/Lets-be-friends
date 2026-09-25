import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { MemberWalletPanelView, type MemberFinance } from './MemberWalletPanel'

type TopUp = MemberFinance['topUps'][number]

const NOW = Date.UTC(2026, 8, 12, 6, 30)

function topUp(overrides: Partial<TopUp>): TopUp {
  return {
    _id: 'topup_story',
    _creationTime: NOW,
    beneficiaryUserId: 'member_story',
    purpose: 'member_booking_balance',
    amountCentavos: 100_000,
    currency: 'PHP',
    mode: 'test',
    status: 'awaiting_payment',
    providerIntentId: 'pi_story',
    qrImageUrl: '/qr-story.png',
    expiresAt: NOW + 600_000,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as unknown as TopUp
}

const finance: MemberFinance = {
  currency: 'PHP',
  availableCentavos: 24_500_00,
  reservedCentavos: 1_300_00,
  pendingCentavos: 0,
  enabled: true,
  topUps: [],
}

const meta = {
  title: 'Features/Wallet/Member wallet panel',
  component: MemberWalletPanelView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    finance,
    busy: false,
    walletError: '',
    now: NOW,
    onCreateTopUp: fn(async () => undefined),
  },
} satisfies Meta<typeof MemberWalletPanelView>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyNoAttempt: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Wallet balance' })).toBeVisible()
    await expect(canvas.getByText('No member-wallet top-up attempt yet.')).toBeVisible()
  },
}

export const Loading: Story = {
  args: { finance: undefined },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Loading booking wallet…'),
    ).toBeVisible()
  },
}

export const AwaitingPaymentWithQr: Story = {
  args: { finance: { ...finance, topUps: [topUp({})] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('timer')).toHaveTextContent('QR expires in')
    await expect(canvas.getByRole('link', { name: 'Download QR' })).toBeVisible()
    await expect(
      canvas.getByRole('button', { name: 'Regenerate QR Ph top-up' }),
    ).toBeEnabled()
  },
}

export const ExpiredQr: Story = {
  args: {
    finance: {
      ...finance,
      topUps: [topUp({ status: 'expired', expiresAt: NOW - 60_000, expiredAt: NOW - 60_000 })],
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('This QR expired. You can create a fresh top-up.'),
    ).toBeVisible()
  },
}

export const PaidAttempt: Story = {
  args: {
    finance: {
      ...finance,
      topUps: [topUp({ status: 'paid', qrImageUrl: undefined, paidAt: NOW, expiresAt: NOW - 1_000 })],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('paid')).toBeVisible()
    await expect(canvas.queryByText(/This QR expired/)).toBeNull()
  },
}

export const WalletDisabledByServer: Story = {
  args: { finance: { ...finance, enabled: false } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/New member-wallet bookings are disabled/),
    ).toBeVisible()
  },
}

export const TopUpStartFailed: Story = {
  args: {
    finance: { ...finance, topUps: [] },
    walletError: 'Top-up could not be started.',
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'Top-up could not be started.',
    )
  },
}

export const NarrowDark: Story = {
  args: { finance: { ...finance, topUps: [topUp({})] } },
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
}
