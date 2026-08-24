import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { SearchField } from './SearchField'

const meta = {
  title: 'Mobile/Molecules/Search field',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function MemberSearchExample({
  initialValue = '',
  loading = false,
  disabled = false,
}: {
  initialValue?: string
  loading?: boolean
  disabled?: boolean
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <View style={{ gap: 8 }}>
      <SearchField
        label="Search members"
        value={value}
        onChange={setValue}
        loading={loading}
        editable={!disabled}
        placeholder="Name, Strength, or activity"
      />
      <AppText variant="caption" accessibilityLiveRegion="polite">
        {loading
          ? 'Updating Companion results.'
          : value
            ? `Showing matches for ${value}.`
            : 'Search for a Companion by name, Strength, or activity.'}
      </AppText>
    </View>
  )
}

export const Empty: Story = {
  render: () => <MemberSearchExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Search members' })

    await userEvent.type(input, 'Alex')
    await expect(input).toHaveValue('Alex')
    await expect(canvas.getByRole('button', { name: 'Clear search' })).toBeVisible()
  },
}

export const Populated: Story = {
  render: () => <MemberSearchExample initialValue="Alex Rivera" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Search members' })

    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }))
    await expect(input).toHaveValue('')
    await expect(input).toHaveFocus()
  },
}

export const Loading: Story = {
  render: () => <MemberSearchExample initialValue="conversation practice" loading />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Search members' })

    await expect(input).toHaveAttribute('aria-busy', 'true')
    await expect(canvas.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  },
}

export const Disabled: Story = {
  render: () => <MemberSearchExample initialValue="Identity checked Companions" disabled />,
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Search members' })
    await expect(input).toHaveAttribute('aria-disabled', 'true')
    await expect(input).toHaveAttribute('readonly')
  },
}

export const LongQueryAt320: Story = {
  render: () => <MemberSearchExample initialValue="Online conversation practice with weekend availability near San Fernando" />,
}
