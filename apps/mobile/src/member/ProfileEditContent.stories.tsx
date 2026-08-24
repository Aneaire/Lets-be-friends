import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { useState } from 'react'

import { ProfileEditContent } from './ProfileEditContent'
import { canSaveProfileEdit, profileEditFieldCopy } from './profileEditFields'

type ProfileEditStoryArgs = {
  initialName: string
  initialBio: string
  busy?: boolean
  onSave: () => void
  onCancel: () => void
}

function ProfileEditStory({ initialName, initialBio, busy = false, onSave, onCancel }: ProfileEditStoryArgs) {
  const [displayName, setDisplayName] = useState(initialName)
  const [bio, setBio] = useState(initialBio)
  const { nameLength, bioLength, nameHint, nameError, bioHint, bioError } = profileEditFieldCopy(displayName, bio)
  const canSave = canSaveProfileEdit(nameLength, bioLength, busy)

  return (
    <ProfileEditContent
      avatarUri={undefined}
      avatarName={displayName || initialName}
      displayName={displayName}
      bio={bio}
      busy={busy}
      canSave={canSave}
      imagePicked={false}
      nameHint={nameHint}
      nameError={nameError}
      bioHint={bioHint}
      bioError={bioError}
      onChangeName={setDisplayName}
      onChangeBio={setBio}
      onChoosePhoto={fn()}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}

const meta = {
  title: 'Mobile/Profile/Edit profile',
  parameters: { viewport: { defaultViewport: 'mobileDefault' } },
  args: {
    initialName: 'Alex Rivera',
    initialBio: 'Coffee enthusiast and weekend hiker.',
    onSave: fn(),
    onCancel: fn(),
  },
  render: (args) => <ProfileEditStory {...args} />,
} satisfies Meta<ProfileEditStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const FilledForm: Story = {}

export const SaveDisabledWhenEmptyName: Story = {
  args: { initialName: '' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const save = canvas.getByRole('button', { name: 'Save profile' })
    await expect(save).toBeDisabled()
    await expect(canvas.getByText('Display name is required.')).toBeVisible()
  },
}

export const CounterUpdatesAsYouType: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const name = canvas.getByLabelText('Display name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Alexandra Marisol Rivera')
    await expect(canvas.getByText(/24\/80 characters/)).toBeVisible()
  },
}

export const SaveTriggersSaveState: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Save profile' }))
    await expect(args.onSave).toHaveBeenCalledOnce()
  },
}
