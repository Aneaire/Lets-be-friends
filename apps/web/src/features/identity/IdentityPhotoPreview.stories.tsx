import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { IdentityPhotoSummary } from './IdentityPhotoPreview'

// Inline SVG bytes stand in for the private ID photos so the story renders
// without a camera or a Convex deployment.
function photoFile(name: string, label: string, tone: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="${tone}"/><text x="160" y="104" font-family="sans-serif" font-size="18" fill="#f7f7f8" text-anchor="middle">${label}</text></svg>`
  return new File([svg], name, { type: 'image/svg+xml' })
}

const meta = {
  title: 'Features/Identity/Identity photo preview',
  component: IdentityPhotoSummary,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    front: photoFile('id-front.jpg', 'Government ID', '#3f4652'),
    back: photoFile('id-back.jpg', 'ID back', '#4a4258'),
    selfie: new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320"><rect width="240" height="320" fill="#3a4a52"/></svg>`], { type: 'image/svg+xml' }),
  },
} satisfies Meta<typeof IdentityPhotoSummary>

export default meta
type Story = StoryObj<typeof meta>

export const AllPhotos: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Front of ID')).toBeVisible()
    await expect(canvas.getByText('Back of ID')).toBeVisible()
    await expect(canvas.getByText('Current selfie')).toBeVisible()
    await expect(canvas.getByText('Photos for review')).toBeVisible()
    await expect(canvasElement.querySelectorAll('img')).toHaveLength(3)

    await userEvent.click(canvas.getByRole('button', { name: 'Open Front of ID larger' }))
    // The viewer renders in a portal on document.body, outside the story canvas.
    await expect(await within(document.body).findByRole('dialog', { name: 'Front of ID' })).toBeVisible()
  },
}

export const FrontOnly: Story = {
  args: { back: null, selfie: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Front of ID')).toBeVisible()
    await expect(canvas.queryByText('Back of ID')).toBeNull()
    await expect(canvas.queryByText('Current selfie')).toBeNull()
    await expect(canvasElement.querySelectorAll('img')).toHaveLength(1)
  },
}

export const NarrowDark: Story = {
  globals: { theme: 'dark', viewport: { value: 'mobileSmall', isRotated: false } },
}
