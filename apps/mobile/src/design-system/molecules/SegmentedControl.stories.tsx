import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { expect, userEvent, within } from 'storybook/test'
import { useState } from 'react'
import { View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { SegmentedControl } from './SegmentedControl'

const meta = {
  title: 'Mobile/Molecules/Segmented control',
  parameters: { viewport: { defaultViewport: 'mobileSmall' } },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const bookingOptions = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'requests', label: 'Requests' },
  { value: 'past', label: 'Past' },
] as const

function BookingViewsExample() {
  const [value, setValue] = useState<(typeof bookingOptions)[number]['value']>('upcoming')

  return (
    <View style={{ gap: 8 }}>
      <SegmentedControl
        label="Booking views"
        options={[...bookingOptions]}
        value={value}
        onChange={setValue}
        tone="social"
      />
      <AppText variant="caption" accessibilityLiveRegion="polite">
        {value === 'requests' ? 'Showing booking requests.' : `Showing ${value} bookings.`}
      </AppText>
    </View>
  )
}

function ThemePreferenceExample() {
  const [value, setValue] = useState<'system' | 'light' | 'dark'>('system')

  return (
    <View style={{ gap: 8 }}>
      <SegmentedControl
        label="Theme preference"
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        value={value}
        onChange={setValue}
        tone="self"
      />
      <AppText variant="caption">Theme: {value}</AppText>
    </View>
  )
}

function DisabledFormatExample() {
  const [value, setValue] = useState<'all' | 'online' | 'in-person'>('all')

  return (
    <View style={{ gap: 8 }}>
      <SegmentedControl
        label="Session format"
        options={[
          { value: 'all', label: 'All' },
          { value: 'online', label: 'Online' },
          { value: 'in-person', label: 'In person', disabled: true },
        ]}
        value={value}
        onChange={setValue}
        tone="neutral"
      />
      <AppText variant="caption">In-person discovery is unavailable while location access is off.</AppText>
    </View>
  )
}

function LongLabelsExample() {
  const [value, setValue] = useState<'weekend' | 'conversation'>('weekend')

  return (
    <SegmentedControl
      label="Discovery focus"
      options={[
        { value: 'weekend', label: 'Available this weekend' },
        { value: 'conversation', label: 'Online conversation practice' },
      ]}
      value={value}
      onChange={setValue}
      tone="social"
    />
  )
}

export const BookingViews: Story = {
  render: () => <BookingViewsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const requests = canvas.getByRole('radio', { name: 'Requests' })

    await userEvent.click(requests)
    await expect(requests).toHaveAttribute('aria-checked', 'true')
    await expect(canvas.getByText('Showing booking requests.')).toBeVisible()
  },
}

export const ThemePreference: Story = { render: () => <ThemePreferenceExample /> }

export const DisabledFormat: Story = {
  render: () => <DisabledFormatExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const inPerson = canvas.getByRole('radio', { name: 'In person' })

    await expect(inPerson).toHaveAttribute('aria-disabled', 'true')
    await expect(canvas.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true')
  },
}

export const LongLabelsAt320: Story = { render: () => <LongLabelsExample /> }
