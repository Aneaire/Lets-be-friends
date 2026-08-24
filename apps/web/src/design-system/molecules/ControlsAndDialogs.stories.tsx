import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { Button } from '../atoms/Button'
import { ConfirmationDialog, Dialog } from './Dialog'
import { SearchField } from './SearchField'
import { SegmentedControl } from './SegmentedControl'

const meta = {
  title: 'Web/Molecules/Selection and overlays',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const themeOptions = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const

function SegmentedControlExample() {
  const [value, setValue] = useState<(typeof themeOptions)[number]['value']>('system')
  return (
    <div className="ds-story-stack">
      <SegmentedControl label="Theme" options={[...themeOptions]} value={value} onChange={setValue} tone="self" />
      <p className="soft">Selected theme: {value}</p>
    </div>
  )
}

function SearchFieldExample({ loading = false }: { loading?: boolean }) {
  const [value, setValue] = useState('Alex')
  return (
    <div className="ds-story-stack">
      <SearchField
        label="Search members"
        value={value}
        onChange={setValue}
        loading={loading}
        placeholder="Search by name or Strength"
      />
      <p className="soft">{value ? `Showing results for ${value}` : 'Start typing to find a member.'}</p>
    </div>
  )
}

function DialogExample({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <Button intent="social" onClick={() => setOpen(true)}>Open booking details</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Booking details"
        description="Review the session context before continuing."
        footer={<Button intent="social" onClick={() => setOpen(false)}>Done</Button>}
      >
        <div className="ds-story-stack">
          <strong>Conversation practice</strong>
          <span className="soft">Online session · Saturday at 2:30 PM · Identity checked</span>
        </div>
      </Dialog>
    </>
  )
}

function ConfirmationDialogExample({ initialOpen = false, busy = false }: { initialOpen?: boolean; busy?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <Button intent="danger" onClick={() => setOpen(true)}>Cancel booking</Button>
      <ConfirmationDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        title="Cancel this booking?"
        description="The other member will be notified. This cannot be undone."
        confirmLabel="Cancel booking"
        busy={busy}
      />
    </>
  )
}

export const SegmentedTheme: Story = {
  render: () => <SegmentedControlExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const system = canvas.getByRole('radio', { name: 'System' })
    system.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect(canvas.getByRole('radio', { name: 'Light' })).toBeChecked()
    await userEvent.keyboard('{End}')
    await expect(canvas.getByRole('radio', { name: 'Dark' })).toBeChecked()
    await userEvent.keyboard('{Home}')
    await expect(system).toBeChecked()
  },
}

export const SearchMembers: Story = {
  render: () => <SearchFieldExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const search = canvas.getByRole('searchbox', { name: 'Search members' })
    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }))
    await expect(search).toHaveFocus()
    await expect(search).toHaveValue('')
    await userEvent.type(search, 'Morgan')
    await expect(canvas.getByText('Showing results for Morgan')).toBeVisible()
  },
}

export const SearchLoading: Story = {
  render: () => <SearchFieldExample loading />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('searchbox', {
        name: 'Search members',
      }),
    ).toHaveAttribute('aria-busy', 'true')
  },
}

export const BookingDialog: Story = {
  render: () => <DialogExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const opener = canvas.getByRole('button', {
      name: 'Open booking details',
    })
    opener.focus()
    await userEvent.click(opener)
    const page = within(document.body)
    const dialog = await page.findByRole('dialog', {
      name: 'Booking details',
    })
    await expect(
      within(dialog).getByRole('button', { name: 'Close dialog' }),
    ).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(page.queryByRole('dialog')).not.toBeInTheDocument()
    await expect(opener).toHaveFocus()
  },
}

export const BookingDialogOpen: Story = {
  render: () => <DialogExample initialOpen />,
}

export const DestructiveConfirmation: Story = {
  render: () => <ConfirmationDialogExample />,
}

export const DestructiveConfirmationOpen: Story = {
  render: () => <ConfirmationDialogExample initialOpen />,
}

export const BusyConfirmationOpen: Story = {
  render: () => <ConfirmationDialogExample initialOpen busy />,
  play: async () => {
    const page = within(document.body)
    const dialog = await page.findByRole('dialog', {
      name: 'Cancel this booking?',
    })
    await userEvent.keyboard('{Escape}')
    await expect(dialog).toBeInTheDocument()
    await expect(
      within(dialog).getByRole('button', { name: 'Close dialog' }),
    ).toBeDisabled()
    const confirm = within(dialog).getByRole('button', {
      name: 'Cancel booking, loading',
    })
    await expect(confirm).toHaveAttribute('aria-busy', 'true')
    await expect(confirm).toHaveTextContent('Working')
  },
}
