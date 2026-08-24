import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { MessageImageGallery, MessageImageViewer, type MessageImage } from './MessageImages'

const images: MessageImage[] = [
  {
    storageId: 'photography-walk',
    url: '/images/marketing/photography-walk-768.webp',
    fileName: 'photography-walk.webp',
  },
  {
    storageId: 'market-friends',
    url: '/images/marketing/market-friends-768.webp',
    fileName: 'market-friends.webp',
  },
  {
    storageId: 'park-picnic',
    url: '/images/marketing/park-picnic-768.webp',
    fileName: 'park-picnic.webp',
  },
]

const meta = {
  title: 'Web/Molecules/Message images',
  parameters: { layout: 'fullscreen' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function MessageImagesExample({ initialImage = null }: { initialImage?: MessageImage | null }) {
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(initialImage)
  return (
    <main style={{ minHeight: '100dvh', padding: 'clamp(1rem, 4vw, 3rem)' }}>
      <section aria-label="Conversation with Alex Rivera" style={{ display: 'grid', maxWidth: '40rem', gap: '0.5rem' }}>
        <div>
          <strong>Alex Rivera</strong>
          <span className="soft"> · 2:24 PM</span>
        </div>
        <p style={{ margin: 0 }}>A few favorites from Saturday’s photo walk.</p>
        <MessageImageGallery images={images} onOpen={setSelectedImage} />
      </section>
      {selectedImage ? <MessageImageViewer image={selectedImage} onClose={() => setSelectedImage(null)} /> : null}
    </main>
  )
}

export const Gallery: Story = {
  render: () => <MessageImagesExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const opener = canvas.getByRole('button', {
      name: 'Open photography-walk.webp',
    })
    opener.focus()
    await userEvent.click(opener)
    const page = within(document.body)
    const dialog = await page.findByRole('dialog', {
      name: 'photography-walk.webp',
    })
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close image' }),
    )
    await expect(page.queryByRole('dialog')).not.toBeInTheDocument()
    await expect(opener).toHaveFocus()
  },
}

export const ViewerOpen: Story = {
  render: () => <MessageImagesExample initialImage={images[0]} />,
  play: async () => {
    const dialog = await within(document.body).findByRole('dialog', {
      name: 'photography-walk.webp',
    })
    await expect(
      within(dialog).getByRole('img', { name: 'photography-walk.webp' }),
    ).toBeVisible()
  },
}

export const MobileViewerOpen: Story = {
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
  render: () => <MessageImagesExample initialImage={images[0]} />,
}
