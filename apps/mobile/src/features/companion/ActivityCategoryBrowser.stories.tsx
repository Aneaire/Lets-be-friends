import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'

import { ActivityCategoryBrowser } from './ActivityCategoryBrowser'

function ActivityCategoryBrowserHarness({ initialSelected = [] as string[], onChange = fn() }: { initialSelected?: string[]; onChange?: (next: string[]) => void }) {
  const [selected, setSelected] = useState(initialSelected)
  return (
    <ActivityCategoryBrowser
      selected={selected}
      onChange={(next) => {
        setSelected(next)
        onChange(next)
      }}
      maximum={6}
    />
  )
}

const meta = {
  title: 'Mobile/Companion/Activity category browser',
  component: ActivityCategoryBrowser,
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  args: { selected: [], onChange: fn(), maximum: 6 },
} satisfies Meta<typeof ActivityCategoryBrowser>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  render: () => <ActivityCategoryBrowserHarness />,
}

export const SelectedChips: Story = {
  render: () => <ActivityCategoryBrowserHarness initialSelected={['Coffee and meals', 'Tech help']} />,
}

export const SearchAndSelect: Story = {
  render: () => <ActivityCategoryBrowserHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Browse categories' }))
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole('dialog', { name: 'Browse activity categories' })
    await userEvent.type(within(dialog).getByLabelText('Search activity categories'), 'dog')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Dog walking' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    await expect(canvas.getByLabelText('Remove Dog walking')).toBeVisible()
  },
}
