import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { CategoryFilterDialog } from './CategoryFilterDialog'

const categories = [
  'Coffee and conversation',
  'City walking',
  'Museum visits',
  'Language practice',
  'Grocery and errands',
  'Technology help',
]

const meta = {
  title: 'Features/Discovery/Category filter dialog',
  component: CategoryFilterDialog,
  parameters: { layout: 'centered' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    open: true,
    categories,
    selectedCategory: null,
    resultCount: 12,
    onChange: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof CategoryFilterDialog>

export default meta
type Story = StoryObj<typeof meta>

async function visibleDialog() {
  const dialog = await within(document.body).findByRole('dialog', { name: 'What would you like to do?' })
  await waitFor(() => expect(dialog).toBeVisible())
  return dialog
}

function Harness({ initialCategory = null as string | null, resultCount = 12 }) {
  const [open, setOpen] = useState(true)
  const [selected, setSelected] = useState<string | null>(initialCategory)
  return (
    <>
      <button type="button" className="btn btn-social" onClick={() => setOpen(true)}>Choose a category</button>
      <CategoryFilterDialog
        open={open}
        categories={categories}
        selectedCategory={selected}
        resultCount={resultCount}
        onChange={setSelected}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

export const Default: Story = {
  render: () => <Harness />,
  play: async () => {
    const dialog = await visibleDialog()
    await expect(within(dialog).getByText('6 categories')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Museum visits' }))
    await expect(
      within(dialog).getByRole('button', { name: 'Museum visits' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      within(dialog).getByRole('button', { name: 'Show 12 results' }),
    ).toBeEnabled()
  },
}

export const SearchFiltersOptions: Story = {
  render: () => <Harness />,
  play: async () => {
    const dialog = await visibleDialog()
    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Search categories' }), 'coffee')
    await expect(within(dialog).getByText('1 category')).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Coffee and conversation' })).toBeVisible()
    await expect(within(dialog).queryByRole('button', { name: 'Museum visits' })).toBeNull()
  },
}

export const NoMatches: Story = {
  render: () => <Harness />,
  play: async () => {
    const dialog = await visibleDialog()
    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Search categories' }), 'zzz')
    await expect(within(dialog).getByText('No categories match that search.')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset search' }))
    await expect(within(dialog).getByText('6 categories')).toBeVisible()
  },
}

export const ClearedSelection: Story = {
  render: () => <Harness initialCategory="City walking" />,
  play: async () => {
    const dialog = await visibleDialog()
    const clear = within(dialog).getByRole('button', { name: 'Clear' })
    await expect(clear).toBeEnabled()
    await userEvent.click(clear)
    await expect(within(dialog).getByRole('button', { name: 'Everything' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const NarrowDark: Story = {
  render: () => <Harness />,
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async () => {
    await visibleDialog()
  },
}
