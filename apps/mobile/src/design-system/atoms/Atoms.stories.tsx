import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { useState } from 'react'
import { View } from 'react-native'
import { ActionButton } from './ActionButton'
import { Avatar } from './Avatar'
import { Checkbox, TextField } from './Field'
import { IconButton } from './IconButton'
import { StatusBadge } from './StatusBadge'

const meta = { title: 'Mobile/Atoms/Core controls', parameters: { viewport: { defaultViewport: 'mobileSmall' } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const ButtonIntents: Story = { render: () => <View style={{ gap: 8 }}><ActionButton label="Message" onPress={() => undefined} intent="social" compact /><ActionButton label="Save profile" onPress={() => undefined} intent="self" compact /><ActionButton label="View details" onPress={() => undefined} secondary compact /><ActionButton label="Delete" onPress={() => undefined} intent="danger" secondary compact /></View> }
export const ButtonLoadingDisabled: Story = { render: () => <View style={{ gap: 8 }}><ActionButton label="Sending" onPress={() => undefined} loading compact /><ActionButton label="Unavailable" onPress={() => undefined} disabled compact /><View style={{ flexDirection: 'row', gap: 8 }}><IconButton label="Post options" icon="ellipsis-horizontal" onPress={() => undefined} /><IconButton label="Marking all notifications read" icon="checkmark-done-outline" loading onPress={() => undefined} /></View></View> }
export const AvatarFallback: Story = { render: () => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Avatar name="Alex Rivera" size={32} /><Avatar name="Alex Rivera" size={40} /><Avatar name="Alex Rivera" uri="https://invalid.example/image.jpg" size={48} /></View> }
export const BadgeTones: Story = { render: () => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><StatusBadge label="Draft" /><StatusBadge label="Verified" tone="self" /><StatusBadge label="Requested" tone="social" /><StatusBadge label="Review" tone="warning" /><StatusBadge label="Completed" tone="success" /><StatusBadge label="Blocked" tone="danger" /></View> }
function FieldStory() { const [checked, setChecked] = useState(true); return <View style={{ gap: 8 }}><TextField accessibilityLabel="Display name" placeholder="Display name" /><TextField accessibilityLabel="About" placeholder="A compact multiline field" multiline /><Checkbox label="Send booking updates" checked={checked} onChange={setChecked} /></View> }
export const FieldTypes: Story = { render: () => <FieldStory /> }
