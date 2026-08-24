import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'

import { PostComposer, type PostComposerMention } from './PostComposer'
import type { PreviewPostMediaItem } from './PostMediaGrid'

const previewPhoto = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect width="800" height="600" fill="%23C1519C"/%3E%3Ccircle cx="400" cy="300" r="120" fill="white" fill-opacity=".84"/%3E%3C/svg%3E'

const mentionSuggestions: PostComposerMention[] = [
  {
    userId: 'member-mariana',
    displayName: 'Mariana de la Cruz-Santos',
    username: 'mariana',
  },
  {
    userId: 'member-marcus',
    displayName: 'Marcus Lee',
    username: 'marcus',
  },
]

const publish = fn()
const chooseMedia = fn()

function ComposerStory({
  initialExpanded = true,
  initialBody = '',
  initialMedia = [],
  busy = false,
  suggestions = [],
}: {
  initialExpanded?: boolean
  initialBody?: string
  initialMedia?: PreviewPostMediaItem[]
  busy?: boolean
  suggestions?: PostComposerMention[]
}) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const [body, setBody] = useState(initialBody)
  const [media, setMedia] = useState(initialMedia)

  return (
    <PostComposer
      expanded={expanded}
      body={body}
      busy={busy}
      media={media}
      remainingUploads={12}
      mentionSuggestions={suggestions}
      onExpand={() => setExpanded(true)}
      onBodyChange={setBody}
      onCaretChange={() => undefined}
      onChooseMedia={chooseMedia}
      onRemoveMedia={(index) => setMedia((items) => items.filter((_, itemIndex) => itemIndex !== index))}
      onSelectMention={(username) => setBody((current) => current.replace(/@[a-z0-9_]*$/i, `@${username} `))}
      onPublish={publish}
    />
  )
}

const meta = {
  title: 'Mobile/Organisms/Post composer',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const CollapsedNarrow320: Story = {
  render: () => <ComposerStory initialExpanded={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create a post' }))
    await expect(canvas.getByRole('textbox', { name: 'Create a text post' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Post' })).toBeDisabled()
  },
}

export const ReadyToPublish: Story = {
  render: () => <ComposerStory initialBody="Does anyone want to practice conversational English this weekend?" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const postButton = canvas.getByRole('button', { name: 'Post' })
    await expect(postButton).toBeEnabled()
    await userEvent.click(postButton)
    await expect(publish).toHaveBeenCalledTimes(1)
  },
}

export const MentionSuggestions: Story = {
  render: () => <ComposerStory initialBody="Thanks @mar" suggestions={mentionSuggestions} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Mention Mariana de la Cruz-Santos as mariana' }))
    await expect(canvas.getByRole('textbox', { name: 'Create a text post' })).toHaveValue('Thanks @mariana ')
  },
}

export const MediaOnlyPost: Story = {
  render: () => (
    <ComposerStory
      initialMedia={[
        {
          key: 'selected-photo',
          kind: 'image',
          previewUrl: previewPhoto,
        },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Post' })).toBeEnabled()
    await userEvent.click(canvas.getByRole('button', { name: 'Remove selected media 1' }))
    await expect(canvas.getByRole('button', { name: 'Post' })).toBeDisabled()
  },
}

export const OverCharacterLimit: Story = {
  render: () => <ComposerStory initialBody={'a'.repeat(1_001)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('1001/1,000. Shorten the post to publish.')
    await expect(canvas.getByRole('button', { name: 'Post' })).toBeDisabled()
  },
}

export const Publishing: Story = {
  render: () => <ComposerStory initialBody="A ready community update" busy />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Post' })).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.getByRole('button', { name: 'Post' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Add photos or videos' })).toBeDisabled()
  },
}
