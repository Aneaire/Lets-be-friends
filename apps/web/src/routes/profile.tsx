import { Link, createFileRoute } from '@tanstack/react-router'
import { SignInButton, useAuth, useUser } from '@clerk/react'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export const Route = createFileRoute('/profile')({ component: ProfilePage })

function ProfilePage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const viewer = useQuery(api.users.viewer)
  const application = useQuery(api.hosts.myApplication)
  const updateProfile = useMutation(api.users.updateProfile)
  const generateProfileImageUploadUrl = useMutation(api.users.generateProfileImageUploadUrl)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null)
  const closeEdit = () => {
    setEditOpen(false)
    setSelectedProfileImage(null)
  }

  if (!isSignedIn) {
    return (
      <main className="marketing-page">
        <p className="eyebrow">Profile</p>
        <h1 className="text-h1 mt-2">Sign in to edit your profile.</h1>
        <p className="lede mt-2">Your normal profile is separate from the Friend Host application review.</p>
        <div className="mt-6">
          <SignInButton mode="modal">
            <button className="btn btn-self">Sign in</button>
          </SignInButton>
        </div>
      </main>
    )
  }

  if (viewer === undefined || application === undefined) {
    return <main className="marketing-page"><div className="empty-state">Loading profile...</div></main>
  }

  const fallbackName = user?.fullName ?? user?.username ?? 'New friend'
  const displayName = viewer?.displayName ?? fallbackName
  const profileImageUrl = viewer?.profileImageUrl ?? user?.imageUrl ?? ''
  const bio = viewer?.bio ?? ''
  const hostStatus = application?.status ?? 'not started'

  return (
    <main className="profile-page">
      {notice && (
        <div className="notice notice-success mb-6">
          <span className="notice-icon">✓</span>
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="notice notice-danger mb-6">
          <span className="notice-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      <section className="profile-hero-panel">
        <div className="profile-cover" aria-hidden="true" />
        <div className="profile-hero-body">
          <ProfilePhoto imageUrl={profileImageUrl} name={displayName} size="xl" />
          <div className="profile-hero-copy">
            <p className="eyebrow">Member profile</p>
            <h1 className="text-h1 mt-2">{displayName}</h1>
            <p className="lede mt-2">{bio || 'No bio added yet.'}</p>
          </div>
          <div className="profile-hero-actions">
            <button type="button" className="btn btn-self btn-sm" onClick={() => setEditOpen(true)}>
              Edit profile
            </button>
            <Link to="/app" search={{}} className="btn btn-neutral btn-sm">Member workspace</Link>
            <Link to="/become-host" className="btn btn-neutral btn-sm">
              {application ? 'Edit host profile' : 'Set up host profile'}
            </Link>
          </div>
        </div>
      </section>

      <div className="profile-public-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="text-h2">About</h2>
              <p className="text-meta mt-1">Visible profile details.</p>
            </div>
          </div>
          <div className="panel-body">
            <dl className="profile-facts">
              <div>
                <dt>Name</dt>
                <dd>{displayName}</dd>
              </div>
              <div>
                <dt>Bio</dt>
                <dd>{bio || 'No bio added yet.'}</dd>
              </div>
              <div>
                <dt>Friend Host profile</dt>
                <dd><span className="status-pill" data-tone={hostStatusTone(hostStatus)}>{hostStatus}</span></dd>
              </div>
            </dl>
          </div>
        </section>

        <aside className="panel">
          <div className="panel-header">
            <div>
              <h2 className="text-h2">Friend Host profile</h2>
              <p className="text-meta mt-1">Host-specific details still go through review.</p>
            </div>
          </div>
          <div className="panel-body flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-meta">Status</span>
              <span className="status-pill" data-tone={hostStatusTone(hostStatus)}>{hostStatus}</span>
            </div>
            <p className="text-body muted">
              The host profile uses your member name. Strengths, mode, boundaries, city, and experience intro are managed separately.
            </p>
            <Link to="/become-host" className="btn btn-neutral btn-sm">
              {application ? 'Edit host profile' : 'Set up host profile'}
            </Link>
          </div>
        </aside>
      </div>

      {editOpen && (
        <div
          className="profile-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEdit()
          }}
        >
          <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
            <form
              onSubmit={async (event) => {
                event.preventDefault()
                setSaving(true)
                setError('')
                try {
                  const form = new FormData(event.currentTarget)
                  const profileImageStorageId = await uploadProfileImage(
                    selectedProfileImage ?? form.get('profileImage'),
                    generateProfileImageUploadUrl,
                  )
                  await updateProfile({
                    displayName: String(form.get('displayName') || fallbackName),
                    profileImageStorageId,
                    bio: String(form.get('bio') || '') || undefined,
                  })
                  setNotice('Profile saved.')
                  closeEdit()
                } catch (profileError) {
                  setError(profileError instanceof Error ? profileError.message : 'Profile could not be saved.')
                } finally {
                  setSaving(false)
                }
              }}
            >
              <div className="profile-dialog-header">
                <div>
                  <h2 id="edit-profile-title" className="text-h2">Edit profile</h2>
                  <p className="text-meta mt-1">Name, picture, and bio do not need review.</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeEdit}>
                  Cancel
                </button>
              </div>
              <div className="profile-dialog-body">
                <label
                  className="profile-upload-card"
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.currentTarget.dataset.dragging = 'true'
                  }}
                  onDragLeave={(event) => {
                    delete event.currentTarget.dataset.dragging
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    delete event.currentTarget.dataset.dragging
                    setSelectedProfileImage(event.dataTransfer.files.item(0))
                  }}
                >
                  <span className="profile-upload-card-icon" aria-hidden="true">+</span>
                  <span className="profile-upload-card-title">Select or drop an image</span>
                  <span className="profile-upload-card-meta">
                    {selectedProfileImage ? selectedProfileImage.name : 'PNG, JPG, or GIF. 5 MB max.'}
                  </span>
                  <input
                    name="profileImage"
                    type="file"
                    accept="image/*"
                    className="profile-upload-input"
                    onChange={(event) => setSelectedProfileImage(event.currentTarget.files?.item(0) ?? null)}
                  />
                </label>
                <label className="field-row">
                  <span className="label">Name</span>
                  <input name="displayName" required defaultValue={displayName} className="field" />
                </label>
                <label className="field-row">
                  <span className="label">Bio <span className="label-aux">optional</span></span>
                  <textarea
                    name="bio"
                    defaultValue={bio}
                    className="field min-h-32"
                    maxLength={500}
                    placeholder="A short profile bio members can recognize across posts and host details."
                  />
                </label>
              </div>
              <div className="profile-dialog-footer">
                <button type="button" className="btn btn-neutral btn-sm" onClick={closeEdit}>
                  Close
                </button>
                <button disabled={saving} className="btn btn-self btn-sm">{saving ? 'Saving...' : 'Save profile'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

async function uploadProfileImage(
  input: FormDataEntryValue | null,
  generateUploadUrl: () => Promise<string>,
): Promise<Id<'_storage'> | undefined> {
  if (!(input instanceof File) || input.size === 0) return undefined
  if (!input.type.startsWith('image/')) throw new Error('Profile image must be an image file.')
  if (input.size > 5 * 1024 * 1024) throw new Error('Profile image must be 5 MB or smaller.')

  const uploadUrl = await generateUploadUrl()
  const result = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': input.type },
    body: input,
  })
  if (!result.ok) throw new Error('Profile image upload failed.')
  const { storageId } = await result.json() as { storageId: string }
  return storageId as Id<'_storage'>
}

function ProfilePhoto({ imageUrl, name, size }: { imageUrl?: string; name: string; size?: 'lg' | 'xl' }) {
  const className = size === 'xl' ? 'profile-photo profile-photo-xl' : size === 'lg' ? 'profile-photo profile-photo-lg' : 'profile-photo'
  return (
    <span className={className} aria-hidden="true">
      {imageUrl ? <img src={imageUrl} alt="" /> : <span>{initials(name)}</span>}
    </span>
  )
}

function hostStatusTone(status: string): 'self' | 'success' | 'warning' | 'danger' {
  if (status === 'approved') return 'success'
  if (status === 'rejected' || status === 'suspended') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'self'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
