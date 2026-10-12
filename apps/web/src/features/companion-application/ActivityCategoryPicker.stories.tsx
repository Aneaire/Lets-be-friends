import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { activityCategories, maximumCompanionActivityCategories } from '@lets-be-friends/shared'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { ActivityCategoryPicker } from './ActivityCategoryPicker'

function CategoryBrowserHarness({ initial = [] as string[] }) {
  const [selected, setSelected] = useState(initial)
  return (
    <ActivityCategoryPicker
      values={activityCategories}
      selected={selected}
      setSelected={setSelected}
      maximum={maximumCompanionActivityCategories}
    />
  )
}

async function openBrowser(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'Browse categories' }))
  const dialog = await within(document.body).findByRole('dialog', { name: 'Browse activity categories' })
  await waitFor(() => expect(dialog).toBeVisible())
  return { canvas, dialog, inDialog: within(dialog) }
}

function optionCount(dialog: HTMLElement) {
  return dialog.querySelectorAll('.category-browser-option').length
}

function dialogScroll(dialog: HTMLElement) {
  const scroll = dialog.querySelector('.category-browser-scroll')
  if (!(scroll instanceof HTMLElement)) throw new Error('Category browser scroll region is missing')
  return scroll
}

const meta = {
  title: 'Web/Features/Companion application/Category browser',
  component: CategoryBrowserHarness,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CategoryBrowserHarness>

export default meta
type Story = StoryObj<typeof meta>

export const BrowseAndPageWithFallback: Story = {
  render: () => <CategoryBrowserHarness />,
  play: async ({ canvasElement }) => {
    const { dialog, inDialog } = await openBrowser(canvasElement)
    await expect(inDialog.getByRole('searchbox', { name: 'Search activity categories' })).toBeVisible()
    const initial = optionCount(dialog)
    await expect(initial).toBeGreaterThanOrEqual(12)
    await userEvent.click(inDialog.getByRole('button', { name: 'Load more categories' }))
    await waitFor(() => expect(optionCount(dialog)).toBeGreaterThan(initial))
  },
}

export const ScrollLoadsMoreOptions: Story = {
  render: () => <CategoryBrowserHarness />,
  play: async ({ canvasElement }) => {
    const { dialog, inDialog } = await openBrowser(canvasElement)
    const scroll = dialogScroll(dialog)
    const initial = optionCount(dialog)
    await expect(initial).toBeGreaterThanOrEqual(12)

    if (initial < activityCategories.length) {
      scroll.scrollTop = scroll.scrollHeight
      await waitFor(() => expect(optionCount(dialog)).toBeGreaterThan(initial), { timeout: 5000 })
    }

    await waitFor(
      () => {
        scroll.scrollTop = scroll.scrollHeight
        expect(inDialog.queryByText(`Showing all ${activityCategories.length} categories`)).toBeVisible()
      },
      { timeout: 10000, interval: 250 },
    )
    await expect(inDialog.queryByRole('button', { name: 'Load more categories' })).toBeNull()
  },
}

export const SearchFiltersAndResets: Story = {
  render: () => <CategoryBrowserHarness />,
  play: async ({ canvasElement }) => {
    const { inDialog } = await openBrowser(canvasElement)
    const search = inDialog.getByRole('searchbox', { name: 'Search activity categories' })
    await userEvent.type(search, 'tech')
    await expect(inDialog.getByText('1 category found')).toBeVisible()
    await expect(inDialog.getByRole('button', { name: 'Tech help' })).toBeVisible()
    await expect(inDialog.queryByRole('button', { name: 'Load more categories' })).toBeNull()

    await userEvent.click(inDialog.getByRole('button', { name: 'Clear category search' }))
    await expect(inDialog.getByText(`${activityCategories.length} categories found`)).toBeVisible()

    await userEvent.type(inDialog.getByRole('searchbox', { name: 'Search activity categories' }), 'zzz no match')
    await expect(inDialog.getByText('No matching activities')).toBeVisible()
    await userEvent.click(inDialog.getByRole('button', { name: 'Reset search' }))
    await expect(inDialog.getByText(`${activityCategories.length} categories found`)).toBeVisible()
  },
}

export const SelectInsideDialogKeepsChips: Story = {
  render: () => <CategoryBrowserHarness />,
  play: async ({ canvasElement }) => {
    const { canvas, dialog, inDialog } = await openBrowser(canvasElement)
    await userEvent.click(inDialog.getByRole('button', { name: 'Good company' }))
    await expect(inDialog.getByRole('button', { name: 'Good company' })).toHaveAttribute('aria-pressed', 'true')
    await expect(canvas.getByRole('button', { name: 'Remove Good company' })).toBeVisible()
    await expect(canvas.getByText('1 of 10 selected')).toBeVisible()

    await userEvent.click(inDialog.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await expect(canvas.getByRole('button', { name: 'Remove Good company' })).toBeVisible()
  },
}

export const KeyboardCloseRestoresFocus: Story = {
  render: () => <CategoryBrowserHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const opener = canvas.getByRole('button', { name: 'Browse categories' })
    opener.focus()
    await userEvent.click(opener)
    const page = within(document.body)
    const dialog = await page.findByRole('dialog', { name: 'Browse activity categories' })
    await waitFor(() => expect(
      within(dialog).getByRole('searchbox', { name: 'Search activity categories' }),
    ).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(page.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())

    await userEvent.click(opener)
    const reopened = await page.findByRole('dialog', { name: 'Browse activity categories' })
    await userEvent.click(within(reopened).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(page.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
  },
}

export const NarrowDark: Story = {
  render: () => <CategoryBrowserHarness initial={['Good company']} />,
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const { dialog, inDialog } = await openBrowser(canvasElement)
    await expect(inDialog.getByRole('searchbox', { name: 'Search activity categories' })).toBeVisible()
    await expect(inDialog.getByRole('button', { name: 'Done' })).toBeVisible()
    const scroll = dialogScroll(dialog)
    await waitFor(
      () => {
        scroll.scrollTop = scroll.scrollHeight
        expect(inDialog.queryByText(`Showing all ${activityCategories.length} categories`)).toBeVisible()
      },
      { timeout: 10000, interval: 250 },
    )
    const searchBox = inDialog.getByRole('searchbox', { name: 'Search activity categories' }).getBoundingClientRect()
    const doneBox = inDialog.getByRole('button', { name: 'Done' }).getBoundingClientRect()
    const dialogBox = dialog.getBoundingClientRect()
    await expect(searchBox.bottom).toBeLessThanOrEqual(dialogBox.bottom)
    await expect(doneBox.bottom).toBeLessThanOrEqual(dialogBox.bottom + 1)
  },
}
