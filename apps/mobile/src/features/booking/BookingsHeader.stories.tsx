import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { BookingsHeader } from './BookingsHeader'

const openWallet = fn()

const meta = {
  title: 'Mobile/Booking/Bookings header',
  component: BookingsHeader,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    wallet: { availableCentavos: 245_000 },
    onOpenWallet: openWallet,
  },
} satisfies Meta<typeof BookingsHeader>

export default meta
type Story = StoryObj<typeof meta>

export const ReadyBalance: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Bookings')).toBeVisible()
    const balance = canvas.getByRole('button', { name: /Open wallet, available balance/ })
    await expect(balance).toBeVisible()
    await expect(balance).toHaveTextContent('₱2,450.00')
    await expect(balance).not.toHaveTextContent('Balance')
    await expect(balance).toHaveStyle({ minHeight: '44px' })
    const pill = balance.firstElementChild as HTMLElement
    await expect(pill).toHaveStyle({
      paddingTop: '4px',
      paddingBottom: '4px',
      paddingLeft: '12px',
      paddingRight: '12px',
    })
    await userEvent.click(balance)
    await expect(openWallet).toHaveBeenCalled()
  },
}

export const LoadingBalance: Story = {
  args: { wallet: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Balance loading…')).toBeVisible()
    await expect(canvas.queryByText('Scan requests, upcoming plans, and history.')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Open wallet, balance loading' }))
    await expect(openWallet).toHaveBeenCalled()
  },
}

export const UnavailableBalance: Story = {
  args: { wallet: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Balance unavailable')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Open wallet, balance unavailable' }))
    await expect(openWallet).toHaveBeenCalled()
  },
}

export const LongBalanceAt320: Story = {
  args: { wallet: { availableCentavos: 12_345_678_900 } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Open wallet, available balance/ })).toBeVisible()
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth + 1)
  },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}
