import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import {
  CircleSafetyConsole,
  type CircleSafetyDetail,
  type CircleSafetyListItem,
} from './CircleSafetyConsole'

const circle: CircleSafetyListItem = {
  _id: 'circle-story',
  slug: 'coffee-friends',
  name: 'Coffee Friends',
  category: 'Coffee',
  mode: 'both',
  approximateArea: 'Cebu City',
  state: 'active',
  settings: {
    discoverability: 'unlisted',
    discussionVisibility: 'members_only',
    memberListVisibility: 'members_only',
    joinPolicy: 'approval_required',
  },
  hasIcon: true,
  hasCover: false,
  host: { displayName: 'Current Host', suspended: false },
  activeMemberCount: 12,
  pendingJoinCount: 2,
  hasPendingTransfer: true,
  updatedAt: Date.UTC(2026, 8, 22, 8),
}

const detail: CircleSafetyDetail = {
  circle: {
    _id: circle._id,
    slug: circle.slug,
    name: circle.name,
    purpose: 'Make space for thoughtful conversation and local coffee walks.',
    category: circle.category,
    rules: ['Respect each member.'],
    mode: circle.mode,
    approximateArea: circle.approximateArea,
    state: circle.state,
    settings: circle.settings,
    iconUrl: '/admin-assets/splash-logo.svg',
    updatedAt: circle.updatedAt,
  },
  host: { displayName: 'Current Host', suspended: false, identityApproved: true },
  pendingTransfer: { displayName: 'Next Host' },
  memberships: [
    {
      membershipId: 'membership-story',
      userId: 'verified-member',
      displayName: 'Verified Member',
      username: 'verified-member',
      accountRole: 'member',
      accountSuspended: false,
      state: 'active',
      role: 'member',
      identityApproved: true,
      updatedAt: circle.updatedAt,
    },
  ],
  posts: [
    {
      postId: 'post-story',
      authorDisplayName: 'Verified Member',
      body: 'Our next coffee walk starts near the public library.',
      circleKind: 'discussion',
      hidden: false,
      createdAt: circle.updatedAt,
    },
  ],
  emergencyHostCandidates: [{ userId: 'verified-member', displayName: 'Verified Member' }],
}

const meta = {
  title: 'Admin/Features/Circle safety console',
  component: CircleSafetyConsole,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: {
    allowed: true,
    rows: [circle],
    detail,
    selectedCircleId: circle._id,
    stateFilter: 'all',
    search: '',
    onStateFilterChange: fn(),
    onSearchChange: fn(),
    onSelect: fn(),
    onSetState: fn(async () => undefined),
    onCancelTransfer: fn(async () => undefined),
    onRecoverHost: fn(async () => undefined),
  },
} satisfies Meta<typeof CircleSafetyConsole>

export default meta
type Story = StoryObj<typeof meta>

export const SuspendConfirmation: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Suspend Circle' }))
    const dialog = within(document.body).getByRole('dialog', { name: 'Suspend Coffee Friends?' })
    await expect(dialog).toHaveTextContent('Members will lose access to Circle content')
    await expect(args.onSetState).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm suspension' }))
    await waitFor(() => expect(args.onSetState).toHaveBeenCalledWith('circle-story', 'suspended'))
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Circle suspended.')
  },
}

export const EmergencyOwnershipRecovery: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Emergency ownership recovery' }))
    const dialog = within(document.body).getByRole('dialog', { name: 'Recover ownership of Coffee Friends?' })
    await userEvent.selectOptions(within(dialog).getByLabelText('New host'), 'verified-member')
    await userEvent.type(within(dialog).getByLabelText('Internal reason'), 'The current host lost account access.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm recovery' }))
    await waitFor(() => expect(args.onRecoverHost).toHaveBeenCalledWith(
      'circle-story',
      'verified-member',
      'The current host lost account access.',
    ))
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Circle ownership recovered.')
  },
}

export const BusySubmission: Story = {
  args: {
    onSetState: fn(() => new Promise<void>(() => undefined)),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Suspend Circle' }))
    const dialog = within(document.body).getByRole('dialog', { name: 'Suspend Coffee Friends?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm suspension' }))
    await expect(dialog).toHaveAttribute('aria-busy', 'true')
    await expect(within(dialog).getByRole('button', { name: 'Confirm suspension' })).toBeDisabled()
    await expect(within(dialog).getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  },
}

export const ReviewerPermissions: Story = {
  args: {
    allowed: false,
    rows: undefined,
    detail: undefined,
    selectedCircleId: null,
  },
  globals: { viewport: { value: 'mobileSmall', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Circle safety is available only to full admins.')).toBeVisible()
    await expect(canvas.queryByText('Our next coffee walk starts near the public library.')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Suspend Circle' })).not.toBeInTheDocument()
  },
}
