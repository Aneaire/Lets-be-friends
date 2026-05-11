import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/social')({ component: SocialPage })

type FeedPost = NonNullable<ReturnType<typeof useQuery<typeof api.social.feed>>>[number]

export function SocialPage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const posts = useQuery(api.social.feed) as FeedPost[] | undefined
  const ensureUser = useMutation(api.users.ensureViewer)
  const createPost = useMutation(api.social.createPost)
  const toggleSave = useMutation(api.social.toggleSavePost)
  const toggleFollow = useMutation(api.social.toggleFollow)
  const report = useMutation(api.reports.create)
  const [notice, setNotice] = useState('')

  return (
    <main className="marketing-page-wide">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <p className="eyebrow">Social</p>
          <h1 className="text-h1 mt-2">Community posts</h1>
          <p className="lede mt-2">
            Share updates, experience moments, and friendly notes. Save posts and follow members you want to find again.
          </p>
        </div>
        <Link to="/discover" className="btn btn-neutral btn-sm">Find hosts</Link>
      </header>

      {notice && (
        <div className="notice notice-success mb-6">
          <span className="notice-icon">✓</span>
          <span>{notice}</span>
        </div>
      )}

      {isSignedIn ? (
        <form
          className="panel p-4 mb-6"
          onSubmit={async (event) => {
            event.preventDefault()
            const form = event.currentTarget
            const data = new FormData(form)
            const body = String(data.get('body') ?? '').trim()
            if (!body) return
            await ensureUser({ displayName: viewer?.displayName ?? user?.fullName ?? user?.username ?? 'New friend' })
            await createPost({ body })
            form.reset()
            setNotice('Post shared.')
          }}
        >
          <label className="field-row">
            <span className="label">Create a post</span>
            <textarea name="body" className="field min-h-24" maxLength={1000} placeholder="Share something friendly, useful, or memorable." />
          </label>
          <div className="flex items-center justify-between gap-3 mt-3">
            <p className="text-meta">Posts are reportable and can be reviewed by the safety team.</p>
            <button className="btn btn-social btn-sm">Post</button>
          </div>
        </form>
      ) : (
        <div className="empty-state mb-6">
          <p className="empty-state-title">Sign in to post, save, or follow.</p>
          <SignInButton mode="modal">
            <button className="btn btn-self btn-sm mt-2">Sign in</button>
          </SignInButton>
        </div>
      )}

      {posts === undefined && <div className="empty-state">Loading posts…</div>}
      {posts && posts.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">No posts yet.</p>
          <p className="text-meta">Be the first to make the product feel alive.</p>
        </div>
      )}
      {posts && posts.length > 0 && (
        <div className="panel">
          <div className="worklist">
            {posts.map((post) => (
              <PostRow
                key={post._id}
                post={post}
                viewerReady={Boolean(viewer)}
                onSave={async () => {
                  await toggleSave({ postId: post._id })
                  setNotice(post.saved ? 'Post removed from saved.' : 'Post saved.')
                }}
                onFollow={async () => {
                  await toggleFollow({ userId: post.authorId })
                  setNotice(post.followingAuthor ? 'User unfollowed.' : 'User followed.')
                }}
                onReport={async () => {
                  await report({ targetType: 'post', targetId: post._id, reason: 'Post needs safety review' })
                  setNotice('Report sent to safety review.')
                }}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

function PostRow({
  post,
  viewerReady,
  onSave,
  onFollow,
  onReport,
}: {
  post: FeedPost
  viewerReady: boolean
  onSave: () => Promise<void>
  onFollow: () => Promise<void>
  onReport: () => Promise<void>
}) {
  return (
    <article className="worklist-row">
      <div className="worklist-row-head">
        <div className="flex items-center gap-3 min-w-0">
          <span className="avatar" aria-hidden="true">{initials(post.authorDisplayName)}</span>
          <div className="min-w-0">
            <h2 className="text-h3">{post.authorDisplayName}</h2>
            <div className="worklist-row-meta">
              <span className="tabular">{formatTime(post.createdAt)}</span>
              {post.experienceBookingId && (
                <>
                  <span className="dot" aria-hidden="true" />
                  <span>Experience post</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!post.ownPost && viewerReady && (
            <button onClick={onFollow} className="btn btn-social-quiet btn-sm">
              {post.followingAuthor ? 'Following' : 'Follow'}
            </button>
          )}
          {viewerReady && (
            <button onClick={onSave} className="btn btn-neutral btn-sm">
              {post.saved ? 'Saved' : 'Save'}
            </button>
          )}
          {viewerReady && <button onClick={onReport} className="btn btn-danger btn-sm">Report</button>}
        </div>
      </div>
      <p className="text-body muted whitespace-pre-wrap max-w-[72ch]">{post.body}</p>
    </article>
  )
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
