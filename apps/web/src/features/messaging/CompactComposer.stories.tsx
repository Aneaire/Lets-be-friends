import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileText, Image as ImageIcon, Video, X } from 'lucide-react'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import { AttachmentMetaRow } from '../../design-system/molecules/AttachmentMetaRow'
import { CompactComposer } from './CompactComposer'

const meta = {
  title: 'Web/Organisms/Compact composer',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  decorators: [(Story) => <div style={{ width: 'min(100%, 24rem)' }}><Story /></div>],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function StandaloneDraftExample() {
  const [value, setValue] = useState('Hey, does 2:30 PM still work for the online session?')
  return (
    <CompactComposer
      value={value}
      canSubmit={Boolean(value.trim()) && value.trim().length <= 2000}
      onChange={setValue}
      onSubmit={() => setValue('')}
    />
  )
}

export const StandaloneEmpty: Story = {
  render: () => <CompactComposer value="" canSubmit={false} onChange={() => undefined} onSubmit={() => undefined} />,
}

export const StandaloneDraft: Story = {
  render: () => <StandaloneDraftExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByLabelText('Message')
    await expect(textarea).toHaveValue('Hey, does 2:30 PM still work for the online session?')
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeEnabled()
  },
}

const readyRows = (
  <>
    <AttachmentMetaRow
      leading={<FileText size={20} aria-hidden="true" />}
      name="session-notes.pdf"
      detail="Original · 2.4 MB"
      state="Ready"
      stateTone="success"
      action={<button type="button" className="ds-compact-composer-remove" aria-label="Remove session-notes.pdf"><X size={14} aria-hidden="true" /></button>}
    />
    <AttachmentMetaRow
      leading={<ImageIcon size={20} aria-hidden="true" />}
      name="arrival-map.png"
      detail="61% smaller · 412 KB from 1.1 MB"
      state="Ready"
      stateTone="success"
      action={<button type="button" className="ds-compact-composer-remove" aria-label="Remove arrival-map.png"><X size={14} aria-hidden="true" /></button>}
    />
  </>
)

type TrayRow = React.ReactNode

function ThreadDraft({ sending = false, preparing = false, tray = readyRows }: { sending?: boolean; preparing?: boolean; tray?: TrayRow }) {
  const [value, setValue] = useState('Sending the notes here.')
  return (
    <CompactComposer
      variant="thread"
      value={value}
      canSubmit={Boolean(value.trim()) && !preparing && !sending}
      sending={sending}
      preparing={preparing}
      attachments={tray}
      onFilesSelected={() => undefined}
      onChange={setValue}
      onSubmit={() => setValue('')}
      hint={<>Press Enter to send · Shift+Enter for a new line · Large media is compressed automatically</>}
    />
  )
}

export const ThreadEmpty: Story = {
  render: () => (
    <CompactComposer
      variant="thread"
      value=""
      canSubmit={false}
      onChange={() => undefined}
      onSubmit={() => undefined}
      hint={<>Press Enter to send · Shift+Enter for a new line · Large media is compressed automatically</>}
    />
  ),
}

export const ThreadWithReadyAttachments: Story = {
  render: () => <ThreadDraft />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Selected files')).toBeTruthy()
    await expect(canvas.getByRole('button', { name: 'Attach files' })).toBeVisible()
    await expect(canvas.getByText('Press Enter to send · Shift+Enter for a new line · Large media is compressed automatically')).toBeTruthy()
  },
}

export const ThreadPreparing: Story = {
  render: () => (
    <ThreadDraft
      preparing
      tray={(
        <AttachmentMetaRow
          leading={<span className="ds-spinner" aria-hidden="true" />}
          name="museum-walk.jpg"
          detail="Compressing media before upload"
          state="42%"
          stateTone="progress"
          action={<button type="button" className="ds-compact-composer-remove" aria-label="Remove museum-walk.jpg"><X size={14} aria-hidden="true" /></button>}
        />
      )}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Preparing/ })).toBeDisabled()
  },
}

export const ThreadSending: Story = {
  render: () => <ThreadDraft sending />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: /Sending/ })).toBeDisabled()
  },
}

function EnterSubmitStory() {
  const [value, setValue] = useState('')
  const [sent, setSent] = useState('')
  return (
    <div>
      <CompactComposer
        value={value}
        canSubmit={Boolean(value.trim()) && value.trim().length <= 2000}
        onChange={setValue}
        onSubmit={() => { setSent(value); setValue('') }}
      />
      {sent ? <p data-testid="sent">{sent}</p> : null}
    </div>
  )
}

export const EnterSubmits: Story = {
  render: () => <EnterSubmitStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByLabelText('Message')
    await userEvent.type(textarea, 'Hello{Enter}')
    await expect(canvas.getByTestId('sent')).toHaveTextContent('Hello')
    await expect(textarea).toHaveValue('')
  },
}

export const ShiftEnterAddsNewline: Story = {
  render: () => <EnterSubmitStory />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByLabelText('Message')
    await userEvent.type(textarea, 'Line one{Shift>}{Enter}{/Shift}Line two')
    await expect(textarea).toHaveValue('Line one\nLine two')
    await expect(canvas.queryByTestId('sent')).toBeNull()
  },
}

export const VideoAttachment: Story = {
  render: () => (
    <CompactComposer
      variant="thread"
      value=""
      canSubmit={false}
      attachments={(
        <AttachmentMetaRow
          leading={<Video size={20} aria-hidden="true" />}
          name="meeting-point.mp4"
          detail="482 KB from 18.7 MB"
          state="Ready"
          stateTone="success"
          action={<button type="button" className="ds-compact-composer-remove" aria-label="Remove meeting-point.mp4"><X size={14} aria-hidden="true" /></button>}
        />
      )}
      onChange={() => undefined}
      onSubmit={() => undefined}
      hint={<>Press Enter to send · Shift+Enter for a new line · Large media is compressed automatically</>}
    />
  ),
}
