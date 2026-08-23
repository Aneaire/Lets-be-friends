import type { Meta, StoryObj } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { ActionButton } from '../atoms/ActionButton'
import { TextField } from '../atoms/Field'
import { AppIcon } from '../atoms/AppIcon'
import { ActionSheetPresentation } from './ActionSheet'
import { EmptyState, InlineNotice } from './FeedbackState'
import { FormField } from './FormField'
import { IdentityRow } from './IdentityRow'
import { Surface } from './Surface'
import { useAppTheme } from '@/theme/ThemeProvider'

const meta = { title: 'Mobile/Molecules/Core patterns', parameters: { viewport: { defaultViewport: 'mobileDefault' } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
const ownerItems = [{ label: 'Edit post', icon: 'create-outline' as const, tone: 'self' as const, onPress: () => undefined }, { label: 'Delete post', icon: 'trash-outline' as const, tone: 'danger' as const, onPress: () => undefined }]
const viewerItems = [{ label: 'Report post', icon: 'flag-outline' as const, tone: 'danger' as const, onPress: () => undefined }]

export const FieldOptional: Story = { render: () => <FormField label="Display name" optional hint="Shown to other members"><TextField defaultValue="Alex Rivera" /></FormField> }
export const FieldError: Story = { render: () => <FormField label="Username" error="This username is already taken"><TextField defaultValue="alex" /></FormField> }
export const ActionSheetOwner: Story = { render: () => <ActionSheetPresentation title="Your post" items={ownerItems} onClose={() => undefined} /> }
export const ActionSheetViewer: Story = { render: () => <ActionSheetPresentation title="Post options" items={viewerItems} onClose={() => undefined} /> }
export const ActionSheetDisabled: Story = { render: () => <ActionSheetPresentation title="Post options" items={[{ ...viewerItems[0], disabled: true }]} onClose={() => undefined} /> }
function FeedbackStory() { const theme = useAppTheme(); return <View style={{ gap: 10 }}><Surface compact><IdentityRow name="Alex Rivera" meta="Active 4 minutes ago" /></Surface><InlineNotice title="Saved">Your changes are ready.</InlineNotice><InlineNotice tone="warning" title="Booking needs attention">Confirm the details before accepting.</InlineNotice><InlineNotice tone="danger" title="Could not save">Try again when your connection returns.</InlineNotice><EmptyState icon={<AppIcon name="people-outline" size={24} color={theme.colors.textMuted} />} title="No conversations yet" description="Open a member profile when you are ready to say hello." action={<ActionButton label="Explore members" onPress={() => undefined} compact />} /></View> }
export const FeedbackTones: Story = { render: () => <FeedbackStory /> }
