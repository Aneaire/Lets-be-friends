import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { AppearanceSettingsPresentation } from './AppearanceSettingsPresentation'

const select = fn()
const retry = fn()

const meta = {
  title: 'Mobile/Settings/Appearance',
  component: AppearanceSettingsPresentation,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: {
    state: { status: 'ready', preference: 'system', message: '' },
    onSelect: select,
    onRetry: retry,
  },
} satisfies Meta<typeof AppearanceSettingsPresentation>

export default meta
type Story = StoryObj<typeof meta>

export const SystemChoice: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: 'System', checked: true })).toBeVisible()
  },
}

export const SelectDark: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: 'Dark' }))
    await expect(select).toHaveBeenCalledWith('dark')
  },
}

export const Loading: Story = {
  args: {
    state: { status: 'loading', preference: 'system', message: 'Loading your appearance choice.' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Loading appearance choice')).toBeVisible()
    await expect(canvas.queryByRole('radiogroup')).not.toBeInTheDocument()
  },
}

export const SaveError: Story = {
  args: {
    state: {
      status: 'error',
      preference: 'light',
      message: 'Your appearance choice could not be saved. It applies until the app restarts.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('could not be saved')
    await userEvent.click(canvas.getByRole('button', { name: 'Load appearance choice again' }))
    await expect(retry).toHaveBeenCalledOnce()
  },
}

export const Unavailable: Story = {
  args: {
    state: {
      status: 'unavailable',
      preference: 'system',
      message: 'Appearance choices are not saved on this device. The system theme is used instead.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('not saved on this device')
  },
}

export const DarkReady: Story = {
  globals: { theme: 'dark' },
  args: {
    state: { status: 'ready', preference: 'dark', message: '' },
  },
}
