import type { Meta, StoryObj } from '@storybook/react-vite'
import { Flag, Pencil, Trash2, UserRoundSearch } from 'lucide-react'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Field'
import { ActionMenu } from './ActionMenu'
import { EmptyState, InlineNotice } from './FeedbackState'
import { FormField } from './FormField'
import { IdentityRow } from './IdentityRow'
import { Surface } from './Surface'

const ownerItems = [{ label: 'Edit post', icon: <Pencil size={16} />, tone: 'self' as const, onSelect: () => undefined }, { label: 'Delete post', icon: <Trash2 size={16} />, tone: 'danger' as const, onSelect: () => undefined }]
const viewerItems = [{ label: 'Report post', icon: <Flag size={16} />, tone: 'danger' as const, onSelect: () => undefined }]
const meta = { title: 'Web/Molecules/Core patterns', parameters: { viewport: { defaultViewport: 'mobileDefault' } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const FieldOptional: Story = { render: () => <div className="ds-story-stack"><FormField label="Display name" optional hint="Shown to other members"><Input defaultValue="Alex Rivera" /></FormField></div> }
export const FieldError: Story = { render: () => <div className="ds-story-stack"><FormField label="Username" error="This username is already taken"><Input defaultValue="alex" /></FormField></div> }
export const ActionMenuOwner: Story = { render: () => <Surface density="compact"><IdentityRow name="Alex Rivera" meta="Your post" action={<ActionMenu label="Post options" items={ownerItems} />} /></Surface> }
export const ActionMenuViewer: Story = { render: () => <Surface density="compact"><IdentityRow name="Alex Rivera" meta="Member post" action={<ActionMenu label="Post options" items={viewerItems} />} /></Surface> }
export const ActionMenuDisabled: Story = { render: () => <ActionMenu label="Post options unavailable" items={viewerItems} disabled /> }
export const FeedbackTones: Story = { render: () => <div className="ds-story-stack"><InlineNotice title="Saved">Your changes are ready.</InlineNotice><InlineNotice tone="warning" title="Booking needs attention">Confirm the details before accepting.</InlineNotice><InlineNotice tone="danger" title="Could not save">Try again when your connection returns.</InlineNotice><EmptyState icon={<UserRoundSearch size={24} />} title="No conversations yet" description="Open a member profile when you are ready to say hello." action={<Button intent="social" size="small">Explore members</Button>} /></div> }
