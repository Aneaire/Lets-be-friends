import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { ThemeToggle } from './ThemeToggle'

const meta = {
  title: 'Admin/Atoms/Theme toggle',
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: /Switch to (dark|light) mode/ })
    const startsDark = button.getAttribute('aria-label') === 'Switch to light mode'
    const nextTheme = startsDark ? 'light' : 'dark'

    await userEvent.click(button)

    await expect(button).toHaveAccessibleName(startsDark ? 'Switch to dark mode' : 'Switch to light mode')
    await expect(document.documentElement).toHaveAttribute('data-theme', nextTheme)
    await expect(window.localStorage.getItem('lets-be-friends-theme')).toBe(nextTheme)
  },
}
