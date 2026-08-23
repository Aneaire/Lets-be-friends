import type { Meta, StoryObj } from '@storybook/react-vite'
import { Bookmark, Plus } from 'lucide-react'
import { expect, within } from 'storybook/test'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { Checkbox, Input, Select, Textarea } from './Field'
import { IconButton } from './IconButton'
import { StatusBadge } from './StatusBadge'

const meta = { title: 'Web/Atoms/Core controls', parameters: { viewport: { defaultViewport: 'mobileSmall' } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const ButtonIntents: Story = {
  render: () => <div className="ds-story-row"><Button intent="social">Message</Button><Button intent="self">Save profile</Button><Button intent="neutral">Details</Button><Button intent="danger">Delete</Button></div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(getComputedStyle(canvas.getByRole('button', { name: 'Message' })).color).toBe('rgb(255, 255, 255)')
    expect(getComputedStyle(canvas.getByRole('button', { name: 'Save profile' })).color).toBe('rgb(255, 255, 255)')
  },
}
export const ButtonLoadingDisabled: Story = { render: () => <div className="ds-story-row"><Button intent="social" loading loadingLabel="Sending">Send message</Button><Button disabled>Unavailable</Button><IconButton label="Save post" tone="social"><Bookmark size={18} /></IconButton><IconButton label="Add" tone="self"><Plus size={18} /></IconButton></div> }
export const AvatarFallback: Story = { render: () => <div className="ds-story-row"><Avatar name="Alex Rivera" size="small" /><Avatar name="Alex Rivera" /><Avatar name="Alex Rivera" src="/missing-profile.jpg" size="large" /></div> }
export const BadgeTones: Story = { render: () => <div className="ds-story-row"><StatusBadge>Draft</StatusBadge><StatusBadge tone="self">Verified</StatusBadge><StatusBadge tone="social">Requested</StatusBadge><StatusBadge tone="warning">Review</StatusBadge><StatusBadge tone="success">Completed</StatusBadge><StatusBadge tone="danger">Blocked</StatusBadge></div> }
export const FieldTypes: Story = {
  render: () => <div className="ds-story-stack"><Input aria-label="Name" placeholder="Display name" /><Textarea aria-label="About" placeholder="A compact multiline field" /><Select aria-label="Session mode" defaultValue="online"><option value="online">Online session</option><option value="person">In-person session</option></Select><Checkbox label="Send booking updates" defaultChecked /></div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Name' })
    input.focus()
    await expect(input).toHaveFocus()
    expect(getComputedStyle(input).outlineStyle).toBe('none')
    expect(getComputedStyle(input).boxShadow).not.toContain('16, 147, 237')
  },
}
