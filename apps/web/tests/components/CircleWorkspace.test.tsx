// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), paginated: vi.fn(), requestJoin: vi.fn() }))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    circles: {
      detail: 'circles.detail', requestToJoin: 'circles.requestToJoin', cancelJoinRequest: 'circles.cancelJoinRequest', leave: 'circles.leave', setMuted: 'circles.setMuted',
      members: 'circles.members', joinRequests: 'circles.joinRequests', decideJoinRequest: 'circles.decideJoinRequest', moderateMember: 'circles.moderateMember',
      removedContent: 'circles.removedContent', setPostRemoved: 'circles.setPostRemoved', setCommentRemoved: 'circles.setCommentRemoved', pinPost: 'circles.pinPost', unpinPost: 'circles.unpinPost',
      hostManagement: 'circles.hostManagement', edit: 'circles.edit', updateSettings: 'circles.updateSettings', generateCircleImageUploadUrl: 'circles.generateCircleImageUploadUrl', setCircleImage: 'circles.setCircleImage', removeCircleImage: 'circles.removeCircleImage', setModerator: 'circles.setModerator', unbanMember: 'circles.unbanMember', initiateHostTransfer: 'circles.initiateHostTransfer', cancelHostTransfer: 'circles.cancelHostTransfer', acceptHostTransfer: 'circles.acceptHostTransfer', setState: 'circles.setState', pinnedPosts: 'circles.pinnedPosts',
    },
    circleEvents: {
      list: 'circleEvents.list', generateThumbnailUploadUrl: 'circleEvents.generateThumbnailUploadUrl', create: 'circleEvents.create', update: 'circleEvents.update', setState: 'circleEvents.setState', removeThumbnail: 'circleEvents.removeThumbnail',
    },
    social: { circleFeed: 'social.circleFeed', requestedPost: 'social.requestedPost', createPost: 'social.createPost', commentsForPost: 'social.commentsForPost', createComment: 'social.createComment', toggleLike: 'social.toggleLike', toggleSavePost: 'social.toggleSavePost', toggleCommentLike: 'social.toggleCommentLike' },
    reports: { create: 'reports.create' },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}))

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useMutation: (...args: unknown[]) => mocks.mutation(...args),
  usePaginatedQuery: (...args: unknown[]) => mocks.paginated(...args),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { CircleWorkspacePage } from '../../src/features/circles/CircleWorkspacePage'

const preview = {
  unavailable: false as const,
  _id: 'circle-1',
  slug: 'coffee',
  name: 'Coffee Friends',
  purpose: 'Talk about coffee.',
  category: 'Coffee',
  rules: ['Be kind.', 'Keep locations private.'],
  mode: 'both' as const,
  approximateArea: 'Cebu',
  memberCount: 4,
  host: { userId: 'host-1', displayName: 'Maya' },
  circleState: 'active' as const,
  membershipState: null,
  role: null,
  muted: false,
  canRead: false,
  canReadDiscussion: false,
  canReadMembers: false,
  canWrite: false,
  canModerate: false,
  isHost: false,
  settings: { discoverability: 'listed', discussionVisibility: 'members_only', memberListVisibility: 'members_only', joinPolicy: 'approval_required' },
  discoverability: 'listed',
  discussionVisibility: 'members_only',
  memberListVisibility: 'members_only',
  joinPolicy: 'approval_required',
  iconUrl: undefined,
  coverUrl: undefined,
  pinnedPostIds: [],
}

const post = {
  _id: 'post-1',
  authorId: 'member-2',
  body: 'A Circle discussion',
  media: [],
  hidden: false,
  reportable: true,
  circleKind: 'discussion' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  authorDisplayName: 'Alex',
  authorProfileImageUrl: undefined,
  liked: false,
  likeCount: 0,
  saved: false,
  savedCount: 0,
  commentCount: 1,
  ownPost: false,
  followingAuthor: false,
}

afterEach(() => { cleanup(); vi.resetAllMocks() })
beforeEach(() => mocks.paginated.mockReturnValue({ results: [], status: 'Exhausted', loadMore: vi.fn() }))

describe('Circle workspace', () => {
  it('requires rule acknowledgement before requesting membership', async () => {
    mocks.query.mockReturnValue(preview)
    mocks.mutation.mockImplementation((fn) => fn === 'circles.requestToJoin' ? mocks.requestJoin : vi.fn())
    mocks.requestJoin.mockResolvedValue('membership-1')

    render(<CircleWorkspacePage circleId="circle-1" />)
    const join = screen.getByRole('button', { name: 'Request to join' })
    expect((join as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /read and agree/i }))
    fireEvent.click(join)

    await waitFor(() => expect(mocks.requestJoin).toHaveBeenCalledWith({ circleId: 'circle-1', rulesAcknowledged: true }))
  })

  it('keeps the preview header compact with a single purpose statement', () => {
    mocks.query.mockReturnValue(preview)
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.getByRole('heading', { name: 'Coffee Friends' })).toBeTruthy()
    expect(screen.getAllByText('Talk about coffee.')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'About this Circle' })).toBeTruthy()
    expect(screen.getByText('4 members')).toBeTruthy()
  })

  it('uses the singular member label for a Circle of one', () => {
    mocks.query.mockReturnValue({ ...preview, memberCount: 1 })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.getByText('1 member')).toBeTruthy()
    expect(screen.queryByText('1 members')).toBeNull()
  })

  it('shows upcoming events to members without leader controls or a separate pinned card', () => {
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'member', canRead: true, canWrite: true }
      if (fn === 'circleEvents.list') return [{ _id: 'event-1', title: 'Coffee crawl', details: 'Meet at the plaza.', startsAt: Date.now() + 86_400_000, location: 'Cebu City', mode: 'in_person', state: 'scheduled', thumbnailUrl: undefined, organizerDisplayName: 'Maya' }]
      return undefined
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.queryByRole('region', { name: 'Pinned posts' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Upcoming events' })).toBeTruthy()
    expect(screen.getByText('Coffee crawl')).toBeTruthy()
    expect(screen.queryByText('Meet at the plaza.')).toBeNull()
    expect(screen.queryByText(/Organized by/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Plan event' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Removed content' })).toBeNull()
  })

  it('offers pin and unpin from the post options menu for leaders', () => {
    mocks.paginated.mockReturnValue({ results: [post], status: 'Exhausted', loadMore: vi.fn() })
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'moderator', canRead: true, canWrite: true, canModerate: true }
      if (fn === 'social.commentsForPost') return []
      return undefined
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.queryByRole('menuitem', { name: 'Pin post' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Post options' }))
    expect(screen.getByRole('menuitem', { name: 'Pin post' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Remove post' })).toBeTruthy()

    cleanup()
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'moderator', canRead: true, canWrite: true, canModerate: true, pinnedPostIds: [post._id] }
      if (fn === 'social.commentsForPost') return []
      return undefined
    })

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Post options' }))
    expect(screen.getByRole('menuitem', { name: 'Unpin post' })).toBeTruthy()
  })

  it('offers event planning to leaders while keeping removed content reachable', () => {
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'moderator', canRead: true, canWrite: true, canModerate: true }
      if (fn === 'circles.pinnedPosts') return []
      if (fn === 'circleEvents.list') return []
      if (fn === 'circles.removedContent') return []
      return undefined
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.queryByRole('region', { name: 'Pinned posts' })).toBeNull()
    expect(screen.getByText('No upcoming events yet. Plan the first one.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Plan event' }))
    expect(screen.getByRole('form', { name: 'Plan event' })).toBeTruthy()
    expect(screen.getByLabelText('Event title')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Removed content' })).toBeTruthy()
    expect(screen.getByText('Nothing is waiting to be restored.')).toBeTruthy()
  })

  it('shows upcoming events read-only to visitors of a public Circle', () => {
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: null, canReadDiscussion: true, canReadMembers: false }
      if (fn === 'circleEvents.list') return [{ _id: 'event-1', title: 'Coffee crawl', details: 'Meet at the plaza.', startsAt: Date.now() + 86_400_000, location: 'Cebu City', mode: 'in_person', state: 'scheduled', thumbnailUrl: undefined, organizerDisplayName: 'Maya' }]
      return undefined
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.getByRole('heading', { name: 'Upcoming events' })).toBeTruthy()
    expect(screen.getByText('Coffee crawl')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Plan event' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Request to join' })).toBeTruthy()
  })

  it('saves public access as signed-in visibility for discussions and members', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined)
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'host', canRead: true, canWrite: true, canModerate: true, isCanonicalHost: true, pendingTransferForViewer: false }
      if (fn === 'circles.hostManagement') return {
        circle: { name: 'Coffee Friends', purpose: 'Talk about coffee.', category: 'Coffee', rules: ['Be kind.'], mode: 'both', approximateArea: 'Cebu', state: 'active', settings: { discoverability: 'listed', discussionVisibility: 'members_only', memberListVisibility: 'members_only', joinPolicy: 'approval_required' }, iconUrl: undefined, coverUrl: undefined },
        activeMembers: [],
        bannedMembers: [],
        pendingTransfer: null,
      }
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'circles.updateSettings' ? updateSettings : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Manage' }))
    fireEvent.change(screen.getByLabelText(/Circle access/), { target: { value: 'public' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save privacy settings' }))

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({
      circleId: 'circle-1',
      discoverability: 'listed',
      discussionVisibility: 'signed_in',
      memberListVisibility: 'signed_in',
      joinPolicy: 'approval_required',
    }))
  })

  it('renders a private unavailable state without Circle content', () => {
    mocks.query.mockReturnValue({ unavailable: true, state: 'suspended', membershipState: 'active' })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.getByRole('heading', { name: 'Circle unavailable' })).toBeTruthy()
    expect(screen.queryByText('Coffee Friends')).toBeNull()
  })

  it('supports keyboard tab navigation and hides moderator controls from members', () => {
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'member', canRead: true, canWrite: true }
      if (fn === 'circles.members') return []
      return undefined
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    const discussions = screen.getByRole('tab', { name: 'Discussions' })
    fireEvent.keyDown(discussions, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'About' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Members' }))
    expect(screen.queryByRole('heading', { name: 'Join requests' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Ban/ })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Manage' })).toBeNull()
  })

  it('shows the join queue only to authorized Circle leaders', () => {
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'moderator', canRead: true, canWrite: true, canModerate: true }
      if (fn === 'circles.members') return []
      if (fn === 'circles.joinRequests') return []
      if (fn === 'circles.removedContent') return []
      return undefined
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Members' }))
    expect(screen.getByRole('heading', { name: 'Join requests' })).toBeTruthy()
    expect(screen.getByText('No pending requests.')).toBeTruthy()
  })

  it('confirms a join-request rejection and announces mutation failures', async () => {
    const decide = vi.fn().mockRejectedValue(new Error('The request could not be rejected.'))
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'moderator', canRead: true, canWrite: true, canModerate: true }
      if (fn === 'circles.members') return []
      if (fn === 'circles.joinRequests') return [{ membershipId: 'request-1', userId: 'member-4', displayName: 'Alex' }]
      if (fn === 'circles.removedContent') return []
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'circles.decideJoinRequest' ? decide : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Members' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))

    expect(decide).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toContain('Alex will not join this Circle. They can request to join again later.')
    fireEvent.click(screen.getByRole('button', { name: 'Reject request' }))

    expect((await screen.findByRole('alert')).textContent).toContain('The request could not be rejected.')
  })

  it('removes reactions, replies, and saves from an archived Circle', () => {
    mocks.paginated.mockReturnValue({ results: [post], status: 'Exhausted', loadMore: vi.fn() })
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, circleState: 'archived', membershipState: 'active', role: 'member', canRead: true, canWrite: false }
      if (fn === 'social.commentsForPost') return [{
        _id: 'comment-1', postId: 'post-1', authorId: 'member-3', body: 'A reply', reportable: true, hidden: false,
        createdAt: Date.now(), updatedAt: Date.now(), authorDisplayName: 'Sam', ownComment: false, likeCount: 0, liked: false,
      }]
      return undefined
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect((screen.getByRole('button', { name: 'Appreciate post' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save post' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show 1 comment/ }))
    expect(screen.queryByRole('textbox', { name: /comment|reply/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Reply/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Like/ })).toBeNull()
  })

  it('announces post action failures instead of leaving a rejected mutation unhandled', async () => {
    const toggleLike = vi.fn().mockRejectedValue(new Error('Like could not be saved.'))
    mocks.paginated.mockReturnValue({ results: [post], status: 'Exhausted', loadMore: vi.fn() })
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'member', canRead: true, canWrite: true }
      if (fn === 'social.commentsForPost') return []
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'social.toggleLike' ? toggleLike : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Appreciate post' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Like could not be saved.')
  })

  it('confirms post removal before calling the mutation and keeps failures accessible', async () => {
    const removePost = vi.fn().mockRejectedValue(new Error('The post could not be removed.'))
    mocks.paginated.mockReturnValue({ results: [post], status: 'Exhausted', loadMore: vi.fn() })
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'moderator', canRead: true, canWrite: true, canModerate: true }
      if (fn === 'social.commentsForPost' || fn === 'circles.removedContent') return []
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'circles.setPostRemoved' ? removePost : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Post options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove post' }))

    expect(removePost).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toContain('A moderator can restore it from removed content.')
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove post' }).at(-1)!)

    expect((await screen.findByRole('alert')).textContent).toContain('The post could not be removed.')
  })

  it('confirms comment removal before calling the mutation', async () => {
    const removeComment = vi.fn().mockResolvedValue(undefined)
    mocks.paginated.mockReturnValue({ results: [post], status: 'Exhausted', loadMore: vi.fn() })
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'moderator', canRead: true, canWrite: true, canModerate: true }
      if (fn === 'social.commentsForPost') return [{
        _id: 'comment-1', postId: 'post-1', authorId: 'member-3', body: 'A reply', reportable: true, hidden: false,
        createdAt: Date.now(), updatedAt: Date.now(), authorDisplayName: 'Sam', ownComment: false, likeCount: 0, liked: false,
      }]
      if (fn === 'circles.removedContent') return []
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'circles.setCommentRemoved' ? removeComment : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('button', { name: /Show 1 comment/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(removeComment).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog').textContent).toContain("Remove Sam's comment?")
    fireEvent.click(screen.getByRole('button', { name: 'Remove comment' }))

    await waitFor(() => expect(removeComment).toHaveBeenCalledWith({ commentId: 'comment-1', removed: true }))
  })

  it('confirms member removal and banning with the access consequence', async () => {
    const moderate = vi.fn().mockResolvedValue(undefined)
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'moderator', canRead: true, canWrite: true, canModerate: true }
      if (fn === 'circles.members') return [{ membershipId: 'membership-2', userId: 'member-2', displayName: 'Alex', role: 'member' }]
      if (fn === 'circles.joinRequests' || fn === 'circles.removedContent') return []
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'circles.moderateMember' ? moderate : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Members' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('dialog').textContent).toContain('Alex will lose access to this Circle. They can request to rejoin later.')
    expect(moderate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }))
    await waitFor(() => expect(moderate).toHaveBeenCalledWith({ membershipId: 'membership-2', action: 'remove' }))

    fireEvent.click(screen.getByRole('button', { name: 'Ban' }))
    expect(screen.getByRole('dialog').textContent).toContain('Alex will lose access to this Circle and cannot request to rejoin.')
  })

  it('shows host-only management and confirms unbanning', async () => {
    const unban = vi.fn().mockResolvedValue(undefined)
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'host', canRead: true, canWrite: true, canModerate: true, isCanonicalHost: true, pendingTransferForViewer: false }
      if (fn === 'circles.hostManagement') return {
        circle: { name: 'Coffee Friends', purpose: 'Talk about coffee.', category: 'Coffee', rules: ['Be kind.'], mode: 'both', approximateArea: 'Cebu', state: 'active', settings: { discoverability: 'listed', discussionVisibility: 'members_only', memberListVisibility: 'members_only', joinPolicy: 'approval_required' }, iconUrl: undefined, coverUrl: undefined },
        activeMembers: [{ membershipId: 'member-row', userId: 'member-2', displayName: 'Alex', role: 'member', trustedRoleEligible: false }],
        bannedMembers: [{ membershipId: 'banned-row', displayName: 'Sam' }],
        pendingTransfer: null,
      }
      if (fn === 'circles.removedContent') return []
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'circles.unbanMember' ? unban : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Manage' }))
    expect(screen.getByRole('heading', { name: 'Banned members' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Make moderator' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Unban' }))
    expect(screen.getByRole('dialog').textContent).toContain('Sam can request to join this Circle again.')
    expect(unban).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Unban member' }))
    await waitFor(() => expect(unban).toHaveBeenCalledWith({ membershipId: 'banned-row' }))
  })

  it('confirms an ownership invitation before the recipient accepts', async () => {
    const accept = vi.fn().mockResolvedValue(undefined)
    mocks.query.mockImplementation((fn) => fn === 'circles.detail'
      ? { ...preview, membershipState: 'active', role: 'member', canRead: true, canWrite: true, pendingTransferForViewer: true, isCanonicalHost: false }
      : undefined)
    mocks.mutation.mockImplementation((fn) => fn === 'circles.acceptHostTransfer' ? accept : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept host transfer' }))
    expect(screen.getByRole('dialog').textContent).toContain('You will become responsible for this Circle')
    expect(accept).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Accept ownership' }))
    await waitFor(() => expect(accept).toHaveBeenCalledWith({ circleId: 'circle-1' }))
  })

  it('explains public visibility and offers an instant join for open Circles', async () => {
    mocks.query.mockReturnValue({
      ...preview,
      discoverability: 'unlisted',
      discussionVisibility: 'signed_in',
      memberListVisibility: 'signed_in',
      joinPolicy: 'open',
      canReadDiscussion: false,
      canReadMembers: false,
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.getByText('Unlisted. Reachable only by direct link.')).toBeTruthy()
    expect(screen.getByText('Discussions open to signed-in members. Join to post, react, or comment.')).toBeTruthy()
    expect(screen.getByText('Member list open to signed-in members.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Join this Circle' })).toBeTruthy()
    expect(screen.getByText('This Circle admits new members instantly. Joining adds you as an active member right away.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /read and agree/i }))
    expect(screen.getByRole('button', { name: 'Join Circle' })).toBeTruthy()
  })

  it('renders read-only discussion and member previews only when the server allows them', () => {
    mocks.paginated.mockReturnValue({ results: [{ _id: 'post-9', body: 'A public discussion', authorDisplayName: 'Alex', createdAt: Date.now() }], status: 'Exhausted', loadMore: vi.fn() })
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, discussionVisibility: 'signed_in', memberListVisibility: 'signed_in', canReadDiscussion: true, canReadMembers: true }
      if (fn === 'circles.members') return [{ membershipId: 'm-1', userId: 'u-1', displayName: 'Alex', username: 'alex', profileImageUrl: undefined, role: 'member' }]
      return undefined
    })
    mocks.mutation.mockReturnValue(vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    expect(screen.getByRole('heading', { name: 'Recent discussions' })).toBeTruthy()
    expect(screen.getByText('A public discussion')).toBeTruthy()
    expect(screen.getByText('Visible to signed-in members. Join this Circle to post, react, or comment.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Members' })).toBeTruthy()
    expect(screen.getByText('Active members only. Membership requests and past members are never shown here.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Post' })).toBeNull()
  })

  it('saves privacy settings with the host-only mutation', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined)
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'host', canRead: true, canWrite: true, canModerate: true, isCanonicalHost: true, pendingTransferForViewer: false }
      if (fn === 'circles.hostManagement') return {
        circle: { name: 'Coffee Friends', purpose: 'Talk about coffee.', category: 'Coffee', rules: ['Be kind.'], mode: 'both', approximateArea: 'Cebu', state: 'active', settings: { discoverability: 'listed', discussionVisibility: 'members_only', memberListVisibility: 'members_only', joinPolicy: 'approval_required' }, iconUrl: undefined, coverUrl: undefined },
        activeMembers: [],
        bannedMembers: [],
        pendingTransfer: null,
      }
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'circles.updateSettings' ? updateSettings : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Manage' }))
    expect(screen.getByRole('heading', { name: 'Privacy settings' })).toBeTruthy()
    expect(screen.getByText(/Banned members stay blocked either way/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Discoverability/), { target: { value: 'unlisted' } })
    fireEvent.change(screen.getByLabelText(/Join policy/), { target: { value: 'open' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save privacy settings' }))

    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({
      circleId: 'circle-1',
      discoverability: 'unlisted',
      discussionVisibility: 'members_only',
      memberListVisibility: 'members_only',
      joinPolicy: 'open',
    }))
  })

  it('rejects non-image Circle uploads client-side and removes the current icon', async () => {
    const removeImage = vi.fn().mockResolvedValue(undefined)
    mocks.query.mockImplementation((fn) => {
      if (fn === 'circles.detail') return { ...preview, membershipState: 'active', role: 'host', canRead: true, canWrite: true, canModerate: true, isCanonicalHost: true, pendingTransferForViewer: false }
      if (fn === 'circles.hostManagement') return {
        circle: { name: 'Coffee Friends', purpose: 'Talk about coffee.', category: 'Coffee', rules: ['Be kind.'], mode: 'both', approximateArea: 'Cebu', state: 'active', settings: { discoverability: 'listed', discussionVisibility: 'members_only', memberListVisibility: 'members_only', joinPolicy: 'approval_required' }, iconUrl: 'https://example.invalid/icon.png', coverUrl: undefined },
        activeMembers: [],
        bannedMembers: [],
        pendingTransfer: null,
      }
      return undefined
    })
    mocks.mutation.mockImplementation((fn) => fn === 'circles.removeCircleImage' ? removeImage : vi.fn())

    render(<CircleWorkspacePage circleId="circle-1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Manage' }))
    expect(screen.getByRole('heading', { name: 'Circle images' })).toBeTruthy()
    const inputs = document.querySelectorAll('input[type="file"]')
    expect(inputs.length).toBe(2)
    const badFile = new File(['bytes'], 'clip.mp4', { type: 'video/mp4' })
    fireEvent.change(inputs[0], { target: { files: [badFile] } })
    expect((await screen.findByRole('alert')).textContent).toContain('JPEG, PNG, or WebP')
    fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }))
    await waitFor(() => expect(removeImage).toHaveBeenCalledWith({ circleId: 'circle-1', kind: 'icon' }))
  })
})
