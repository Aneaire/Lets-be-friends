import type { Meta, StoryObj } from '@storybook/react-vite'
import { Bookmark, Plus } from 'lucide-react'
import { expect, within } from 'storybook/test'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { Checkbox, Input, Select, Textarea } from './Field'
import { IconButton } from './IconButton'
import { StatusBadge } from './StatusBadge'

const meta = { title: 'Web/Atoms/Core controls', globals: { viewport: { value: 'mobileSmall', isRotated: false } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const ButtonIntents: Story = {
  render: () => <div className="ds-story-row"><Button intent="social">Message</Button><Button intent="self">Save profile</Button><Button intent="neutral">Details</Button><Button intent="danger">Delete</Button></div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const root = getComputedStyle(document.documentElement)
    const resolveToken = (name: string) => {
      const probe = document.createElement('span')
      probe.style.backgroundColor = root.getPropertyValue(name).trim()
      document.body.append(probe)
      const value = getComputedStyle(probe).backgroundColor
      probe.remove()
      return value
    }
    const messageButton = getComputedStyle(canvas.getByRole('button', { name: 'Message' }))
    const saveButton = getComputedStyle(canvas.getByRole('button', { name: 'Save profile' }))
    expect(messageButton.backgroundColor).toBe(resolveToken('--accent-social-control'))
    expect(saveButton.backgroundColor).toBe(resolveToken('--accent-self-control'))
    expect(messageButton.color).toBe(resolveToken('--accent-control-foreground'))
    expect(saveButton.color).toBe(resolveToken('--accent-control-foreground'))
    expect(root.getPropertyValue('--accent-social-button').trim()).toBe('#C1519C')
    expect(root.getPropertyValue('--accent-self-button').trim()).toBe('#1093ED')
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
