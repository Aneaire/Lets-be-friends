import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertTriangle, FileText, Image as ImageIcon, RefreshCw, Video, X } from 'lucide-react'
import { Button } from '../atoms/Button'
import { IconButton } from '../atoms/IconButton'
import { AttachmentMetaRow } from './AttachmentMetaRow'

const meta = {
  title: 'Web/Molecules/Attachment meta row',
  component: AttachmentMetaRow,
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  decorators: [(Story) => <div style={{ width: 'min(100%, 34rem)' }}><Story /></div>],
} satisfies Meta<typeof AttachmentMetaRow>

export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  args: {
    leading: <FileText size={20} aria-hidden="true" />,
    name: 'conversation-notes.pdf',
    detail: 'PDF · 2.4 MB',
    state: 'Ready',
    stateTone: 'success',
    action: <IconButton label="Remove conversation-notes.pdf"><X size={17} aria-hidden="true" /></IconButton>,
  },
}

export const Preparing: Story = {
  args: {
    leading: <span className="ds-spinner" aria-hidden="true" />,
    name: 'museum-walk.jpg',
    detail: 'Compressing image for chat',
    state: '42%',
    stateTone: 'progress',
    action: <IconButton label="Remove museum-walk.jpg"><X size={17} aria-hidden="true" /></IconButton>,
  },
}

export const Uploading: Story = {
  args: {
    leading: <Video size={20} aria-hidden="true" />,
    name: 'meeting-point.mp4',
    detail: 'Video · 18.7 MB',
    state: 'Uploading 68%',
    stateTone: 'progress',
    action: <IconButton label="Cancel meeting-point.mp4 upload"><X size={17} aria-hidden="true" /></IconButton>,
  },
}

export const Failed: Story = {
  args: {
    leading: <AlertTriangle size={20} aria-hidden="true" />,
    name: 'booking-details.docx',
    detail: 'The upload connection was interrupted.',
    state: 'Upload failed',
    stateTone: 'danger',
    action: <Button size="small" intent="neutral" leadingIcon={<RefreshCw size={15} aria-hidden="true" />}>Retry</Button>,
  },
}

export const LongName: Story = {
  args: {
    leading: <ImageIcon size={20} aria-hidden="true" />,
    name: 'saturday-afternoon-conversation-practice-meeting-point-near-the-museum-entrance-original.jpg',
    detail: 'JPEG · 3.8 MB · 61% smaller',
    state: 'Ready',
    stateTone: 'success',
    action: <IconButton label="Remove long image filename"><X size={17} aria-hidden="true" /></IconButton>,
  },
}
