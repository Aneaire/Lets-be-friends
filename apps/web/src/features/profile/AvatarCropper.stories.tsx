import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AvatarCropper } from './AvatarCropper'
import { defaultAvatarCrop, type AvatarCrop } from './avatarCrop'

const demoAvatar = new File([
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
    <rect width="900" height="1200" fill="#d7d7d7"/>
    <rect x="70" y="80" width="760" height="1040" rx="80" fill="#8b8b8b"/>
    <circle cx="450" cy="410" r="230" fill="#eeeeee"/>
    <path d="M165 1080c24-270 126-410 285-410s261 140 285 410" fill="#202020"/>
    <circle cx="370" cy="390" r="24" fill="#202020"/>
    <circle cx="530" cy="390" r="24" fill="#202020"/>
  </svg>`,
], 'portrait.svg', { type: 'image/svg+xml' })

function CropperStory() {
  const [crop, setCrop] = useState<AvatarCrop>(defaultAvatarCrop)
  return (
    <div style={{ width: 'min(100%, 34rem)', padding: '1rem' }}>
      <AvatarCropper file={demoAvatar} crop={crop} onChange={setCrop} />
    </div>
  )
}

const meta = {
  title: 'Web/Molecules/Avatar cropper',
  parameters: { layout: 'centered' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <CropperStory />,
}
