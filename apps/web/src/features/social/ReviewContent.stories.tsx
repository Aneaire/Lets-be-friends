import type { Meta, StoryObj } from '@storybook/react-vite'

import { ReviewContent } from './ReviewContent'

function fluidPhoto(label: string, width: number, height: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#d8d8d8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(width / 12)}" fill="#111111">${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const meta = {
  title: 'Web/Molecules/Review content',
  component: ReviewContent,
  parameters: { layout: 'padded' },
  globals: { viewport: { value: 'mobileDefault', isRotated: false } },
  args: {
    rating: 5,
    showRatingValue: true,
    body: 'This guy is awesome, will book again next time.',
    reviewerDisplayName: 'Gelo Santiago',
  },
} satisfies Meta<typeof ReviewContent>

export default meta
type Story = StoryObj<typeof meta>

export const PortraitPhoto: Story = {
  args: {
    imageUrl: fluidPhoto('Portrait 3:4', 600, 800),
  },
}

export const LandscapePhoto: Story = {
  args: {
    imageUrl: fluidPhoto('Landscape 3:2', 900, 600),
  },
}

export const ThreePhotoCollage: Story = {
  args: {
    imageUrl: undefined,
    imageUrls: [
      fluidPhoto('Portrait', 600, 800),
      fluidPhoto('Square', 700, 700),
      fluidPhoto('Landscape', 900, 600),
    ],
  },
}
