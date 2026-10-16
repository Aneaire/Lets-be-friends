import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'

import {
  IdentityEvidenceGrid,
  IdentityImageLightbox,
  type IdentityEvidenceImage,
  type IdentityImageKind,
} from './IdentityImagePanel'

// Inline SVG data URLs stand in for the private ID bytes so the story renders
// without a Convex deployment.
function placeholderPhoto(label: string, tone: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="${tone}"/><text x="160" y="104" font-family="sans-serif" font-size="18" fill="#f7f7f8" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const front: IdentityEvidenceImage = { kind: 'id_front', label: 'Front of ID', url: placeholderPhoto('Government ID', '#3f4652'), error: null }
const back: IdentityEvidenceImage = { kind: 'id_back', label: 'Back of ID', url: placeholderPhoto('ID back', '#4a4258'), error: null }
const selfie: IdentityEvidenceImage = { kind: 'selfie', label: 'Current selfie', url: placeholderPhoto('Selfie', '#3a4a52'), error: null }
const unavailable: IdentityEvidenceImage = { kind: 'id_back', label: 'Back of ID', url: null, error: 'This identity image is not retained' }
const grantedUntil = Date.UTC(2026, 9, 16, 21, 4)

// Adds the lightbox interaction the dialog wires up, so the stories show the
// same behaviour a reviewer gets.
function GridHarness({ images = [], expectedKinds = [], expiresAt = null, loading = false, expired = false }: {
  images?: IdentityEvidenceImage[]
  expectedKinds?: IdentityImageKind[]
  expiresAt?: number | null
  loading?: boolean
  expired?: boolean
}) {
  const [expanded, setExpanded] = useState<IdentityImageKind | null>(null)
  const expandedImage = images.find((image) => image.kind === expanded) ?? null
  return (
    <>
      <IdentityEvidenceGrid
        images={images}
        expectedKinds={expectedKinds}
        expiresAt={expiresAt}
        loading={loading}
        expired={expired}
        onReload={fn()}
        onOpenImage={setExpanded}
      />
      {expandedImage?.url && (
        <IdentityImageLightbox label={expandedImage.label} url={expandedImage.url} onClose={() => setExpanded(null)} />
      )}
    </>
  )
}

const meta = {
  title: 'Admin/Identity evidence images',
  component: IdentityEvidenceGrid,
  parameters: { layout: 'padded' },
  args: { expiresAt: grantedUntil },
  render: (args) => <GridHarness {...args} />,
} satisfies Meta<typeof IdentityEvidenceGrid>

export default meta
type Story = StoryObj<typeof meta>

export const AllImages: Story = {
  args: { images: [front, back, selfie] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Every retained image is on screen without a click.
    for (const label of ['Front of ID', 'Back of ID', 'Current selfie']) {
      const button = await canvas.findByRole('button', { name: `Open ${label} larger` })
      await expect(button.querySelector('img')).toBeTruthy()
    }

    // Clicking a thumbnail opens it larger, and Escape closes it again.
    await userEvent.click(canvas.getByRole('button', { name: 'Open Front of ID larger' }))
    const dialog = await canvas.findByRole('dialog', { name: 'Front of ID at full size' })
    await expect(within(dialog).getByRole('link', { name: 'Open in new tab' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument()
  },
}

export const OneUnavailable: Story = {
  args: { images: [front, unavailable] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect((await canvas.findByRole('button', { name: 'Open Front of ID larger' })).querySelector('img')).toBeTruthy()
    await expect(canvas.getByText('This identity image is not retained')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /Back of ID/ })).toBeDisabled()
  },
}

export const LightboxOpen: Story = {
  args: { images: [front, back] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: 'Open Back of ID larger' }))
    await expect(await canvas.findByRole('dialog', { name: 'Back of ID at full size' })).toBeInTheDocument()
  },
}

export const Loading: Story = {
  args: { images: [], expectedKinds: ['id_front', 'id_back', 'selfie'], loading: true, expired: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // A placeholder per expected image, so the grid keeps its shape while loading.
    await expect(canvasElement.querySelectorAll('.identity-image-skeleton')).toHaveLength(3)
    await expect(canvas.getByText('Loading identity images...')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Loading...' })).toBeDisabled()
    await expect(canvasElement.querySelector('.identity-image-grid')).toHaveAttribute('aria-busy', 'true')
  },
}

export const AccessExpired: Story = {
  args: { images: [], expectedKinds: ['id_front'], loading: false, expired: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Image access expired. Reload to view them again.')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Reload images' })).toBeEnabled()
  },
}
