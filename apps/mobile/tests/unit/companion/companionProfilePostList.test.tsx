import { isValidElement, type ReactNode } from 'react'

import { CompanionProfilePostList } from '@/features/companion/CompanionProfilePostList'
import { SocialPostCard } from '@/features/social/SocialPostCard'

jest.mock('@/features/social/SocialPostCard', () => ({ SocialPostCard: 'SocialPostCard' }))

type TestElement = {
  type: unknown
  props: Record<string, any> & { children?: ReactNode }
}

function asElements(value: unknown): TestElement[] {
  const flat = Array.isArray(value) ? value : [value]
  return flat.flat(Infinity).filter(isValidElement) as unknown as TestElement[]
}

function findAll(element: unknown, predicate: (node: TestElement) => boolean): TestElement[] {
  const matches: TestElement[] = []
  const visit = (node: unknown) => {
    if (!isValidElement(node)) return
    const candidate = node as unknown as TestElement
    if (predicate(candidate)) matches.push(candidate)
    for (const child of asElements(candidate.props.children)) visit(child)
  }
  visit(element)
  return matches
}

function enrichedPost(overrides = {}) {
  return {
    _id: 'post-1',
    authorId: 'user-companion',
    authorDisplayName: 'Alex Rivera',
    authorUsername: 'alex_rivera',
    authorProfileImageUrl: 'https://example.com/avatar.png',
    authorCompanionProfileId: 'companion-1',
    createdAt: 1_786_000_000_000,
    body: 'Sunset walk photos from the weekend group.',
    mentions: [{ username: 'sam', userId: 'user-sam', offset: 0, length: 4 }],
    media: [{ storageId: 'media-1', kind: 'image', url: 'https://example.com/photo.png' }],
    poll: {
      question: 'Which time works better?',
      options: [
        { id: 'morning', label: 'Saturday morning', voteCount: 6, percentage: 66.7 },
        { id: 'afternoon', label: 'Sunday afternoon', voteCount: 3, percentage: 33.3 },
      ],
      totalVotes: 9,
      closed: false,
    },
    featuredComment: null,
    liked: true,
    likeCount: 4,
    saved: true,
    commentCount: 2,
    followingAuthor: true,
    ownPost: false,
    profilePictureUpdate: false,
    ...overrides,
  }
}

describe('companion profile post list delegates to the shared social card', () => {
  it('passes the full enriched post through with signed-in gating, photo viewer, and follow wiring', () => {
    const post = enrichedPost()
    const onToggleFollow = jest.fn()
    const onOpenImage = jest.fn()

    const element = CompanionProfilePostList({
      posts: [post as never],
      signedIn: true,
      following: true,
      followBusy: false,
      onToggleFollow,
      onOpenImage,
    })

    const cards = findAll(element, (node) => node.type === SocialPostCard)
    expect(cards).toHaveLength(1)
    expect(cards[0].props.post).toBe(post)
    expect(cards[0].props.post).toMatchObject({
      body: 'Sunset walk photos from the weekend group.',
      authorUsername: 'alex_rivera',
      liked: true,
      saved: true,
      commentCount: 2,
      followingAuthor: true,
      ownPost: false,
    })
    expect(cards[0].props.post.media).toHaveLength(1)
    expect(cards[0].props.signedIn).toBe(true)
    expect(cards[0].props.following).toBe(true)
    expect(cards[0].props.followBusy).toBe(false)
    expect(cards[0].props.onToggleFollow).toBe(onToggleFollow)
    expect(cards[0].props.onOpenImage).toBe(onOpenImage)
  })

  it('forwards follow busy state while the profile follow mutation is in flight', () => {
    const element = CompanionProfilePostList({
      posts: [enrichedPost() as never],
      signedIn: true,
      following: false,
      followBusy: true,
      onToggleFollow: jest.fn(),
      onOpenImage: jest.fn(),
    })

    const cards = findAll(element, (node) => node.type === SocialPostCard)
    expect(cards).toHaveLength(1)
    expect(cards[0].props.followBusy).toBe(true)
    expect(cards[0].props.following).toBe(false)
  })

  it('omits the post follow control for signed-out viewers and keeps ownership flags', () => {
    const signedOut = CompanionProfilePostList({
      posts: [enrichedPost() as never],
      signedIn: false,
      following: false,
      followBusy: false,
      onToggleFollow: undefined,
      onOpenImage: jest.fn(),
    })
    const signedOutCards = findAll(signedOut, (node) => node.type === SocialPostCard)
    expect(signedOutCards).toHaveLength(1)
    expect(signedOutCards[0].props.signedIn).toBe(false)
    expect(signedOutCards[0].props.onToggleFollow).toBeUndefined()

    const owned = CompanionProfilePostList({
      posts: [enrichedPost({ ownPost: true }) as never],
      signedIn: true,
      following: false,
      followBusy: false,
      onToggleFollow: undefined,
      onOpenImage: jest.fn(),
    })
    const ownedCards = findAll(owned, (node) => node.type === SocialPostCard)
    expect(ownedCards).toHaveLength(1)
    expect(ownedCards[0].props.post.ownPost).toBe(true)
  })
})
