import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { PostComposerView } from './PostComposerDialog'
import { emptyPollDraft } from './PollComposer'

const meta = {
  title: 'Features/Social/Post composer',
  component: PostComposerView,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    authorName: 'Robin Lee',
    body: '',
    media: [],
    dragging: false,
    busy: false,
    error: '',
    uploadsHint: '5 of 5 daily media uploads left',
    bodyField: (
      <textarea
        className="post-editor-body"
        aria-label="Post text"
        placeholder="What could feel easier or better together?"
        value=""
        readOnly
      />
    ),
    onBodyChange: () => undefined,
    onChooseMedia: () => undefined,
    onRemoveMedia: () => undefined,
    onDraggingChange: () => undefined,
  },
} satisfies Meta<typeof PostComposerView>

export default meta
type Story = StoryObj<typeof meta>

export const TextOnly: Story = {
  args: { body: 'Anyone free to help me move a desk on Saturday?' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('article', { name: 'Write your post' })).toBeVisible()
    await expect(canvas.getByText('Drag photos or video here, or choose files')).toBeVisible()
    await expect(canvas.getByText('5 of 5 daily media uploads left')).toBeVisible()
  },
}

export const WithPhotos: Story = {
  args: {
    body: 'Found the perfect spot for the study session.',
    media: [
      { file: new File(['a'], 'desk.png', { type: 'image/png' }), kind: 'image', previewUrl: 'https://placehold.co/400x400/png' },
      { file: new File(['b'], 'room.png', { type: 'image/png' }), kind: 'image', previewUrl: 'https://placehold.co/400x400/png?text=2' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelector('.social-media-preview-grid')).toBeTruthy()
    await expect(canvas.getByText('Add more photos or video')).toBeVisible()
  },
}

export const DraggingMedia: Story = {
  args: { dragging: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Drop to add photos or video'),
    ).toBeVisible()
  },
}

export const Poll: Story = {
  args: {
    body: 'Planning the next study session.',
    poll: { ...emptyPollDraft(), question: 'Which evening works for everyone?', options: ['Friday', 'Saturday'] },
    onPollChange: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Poll', { selector: 'legend' })).toBeVisible()
    await expect(canvas.getByDisplayValue('Which evening works for everyone?')).toBeVisible()
    await expect(canvas.getByDisplayValue('Friday')).toBeVisible()
  },
}

export const MediaRejected: Story = {
  args: { error: 'notes.txt is not a photo or video.' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('alert'),
    ).toHaveTextContent('is not a photo or video')
  },
}

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
  args: { body: 'Anyone free on Saturday?' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('article', { name: 'Write your post' }),
    ).toBeVisible()
  },
}
