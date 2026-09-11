import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { CircleDot, ImagePlus, MapPin, Plus, Users, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { uploadCircleImage } from './CircleWorkspacePage'

type CircleSummary = NonNullable<ReturnType<typeof useQuery<typeof api.circles.discover>>>[number]

function CircleMarker({ circle }: { circle: Pick<CircleSummary, 'mode' | 'iconUrl' | 'name'> & { membershipState?: string } }) {
  const mode = circle.mode === 'in_person' ? 'In person' : circle.mode === 'online' ? 'Online' : 'Online and in person'
  if (circle.iconUrl) return <img className="circle-icon" src={circle.iconUrl} alt={`${circle.name}, ${mode}${circle.membershipState === 'active' ? ', joined' : ''}`} />
  return <span className="circle-marker" data-member={circle.membershipState === 'active'} aria-label={`${mode}${circle.membershipState === 'active' ? ', joined' : ''}`} />
}

function CircleRow({ circle }: { circle: CircleSummary & { membershipState?: string; circleState?: string; role?: string } }) {
  return (
    <Link to="/circles/$circleId" params={{ circleId: circle._id }} className="circle-index-row">
      <CircleMarker circle={circle} />
      <span className="circle-index-copy">
        <span className="circle-index-title">
          <strong>{circle.name}</strong>
          {circle.role && circle.role !== 'member' && <span className="status-pill" data-tone="social">{circle.role}</span>}
          {circle.circleState === 'archived' && <span className="status-pill">Archived</span>}
          {circle.joinPolicy === 'open' && <span className="status-pill" data-tone="social">Open join</span>}
        </span>
        <span>{circle.purpose}</span>
        <span className="circle-index-meta">
          <span><Users size={13} aria-hidden="true" /> {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'}</span>
          <span><MapPin size={13} aria-hidden="true" /> {circle.approximateArea ?? (circle.mode === 'online' ? 'Online' : 'Area shared in Circle')}</span>
        </span>
      </span>
      <span className="circle-index-category">{circle.category}</span>
    </Link>
  )
}

export function CircleIndexPage() {
  const mine = useQuery(api.circles.mine)
  const discover = useQuery(api.circles.discover)
  const eligibility = useQuery(api.circles.creationEligibility)
  const createCircle = useMutation(api.circles.create)
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')
  const [rules, setRules] = useState<string[]>([''])
  const [createFormValid, setCreateFormValid] = useState(false)
  const [iconStorageId, setIconStorageId] = useState<Id<'_storage'> | null>(null)
  const [coverStorageId, setCoverStorageId] = useState<Id<'_storage'> | null>(null)
  const [iconPreview, setIconPreview] = useState<string | undefined>()
  const [coverPreview, setCoverPreview] = useState<string | undefined>()
  const [dragOver, setDragOver] = useState<'icon' | 'cover' | null>(null)
  const generateCreateUploadUrl = useMutation(api.circles.generateCreateImageUploadUrl)

  function resetCreateForm() {
    setCreateError('')
    setRules([''])
    setCreateFormValid(false)
    setIconStorageId(null)
    setCoverStorageId(null)
    setIconPreview(undefined)
    setCoverPreview(undefined)
  }

  async function uploadCreateImage(kind: 'icon' | 'cover', file: File | null) {
    if (!file || file.size === 0 || submitting) return
    setSubmitting(true)
    setCreateError('')
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Circle images must be JPEG, PNG, or WebP still images.')
      if (file.size > 5 * 1024 * 1024) throw new Error('Circle images must be 5 MB or smaller.')
      const storageId = await uploadCircleImage(file, () => generateCreateUploadUrl({ kind }))
      if (kind === 'icon') {
        setIconStorageId(storageId)
        setIconPreview(URL.createObjectURL(file))
      } else {
        setCoverStorageId(storageId)
        setCoverPreview(URL.createObjectURL(file))
      }
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'The Circle image could not be uploaded.')
    } finally {
      setSubmitting(false)
    }
  }
  const mineRows = Array.isArray(mine) ? mine : []
  const discoverRows = Array.isArray(discover) ? discover : []
  const myIds = new Set(mineRows.map((circle) => String(circle._id)))
  const available = discoverRows.filter((circle) => !myIds.has(String(circle._id)))
  const loading = mine === undefined || discover === undefined
  const canCreate = eligibility?.eligible === true
  const needsVerification = eligibility?.reason === 'verification_required'
  const submittedRules = rules.map((rule) => rule.trim()).filter(Boolean)

  return (
    <main className="circles-index-page">
      <header className="circles-index-header">
        <div>
          <span className="eyebrow">Shared interests</span>
          <h1>Circles</h1>
          <p>Find a familiar group, follow the conversation, and get to know people at your own pace.</p>
        </div>
        <div className="circle-index-header-actions">
          {canCreate ? <button type="button" className="btn btn-self" onClick={() => { resetCreateForm(); setCreating(true) }}><Plus size={16} aria-hidden="true" /> Create Circle</button> : needsVerification ? <Link to="/verify-identity" search={{ intent: 'member', returnTo: '/profile' }} className="btn btn-self-quiet">Verify to create a Circle</Link> : null}
          <CircleDot size={42} strokeWidth={1.25} aria-hidden="true" />
        </div>
      </header>

      {eligibility && !eligibility.eligible && <p className="circle-create-requirement" role="status">{needsVerification ? 'Current identity verification is required before you can create and host a Circle.' : 'Your account role is not eligible to create or host a Circle.'}</p>}
      {creating && (
        <section className="circle-create-panel" aria-labelledby="create-circle-title">
          <div className="circle-create-heading"><div><span className="eyebrow">Host a community</span><h2 id="create-circle-title">Create a Circle</h2></div><button type="button" className="icon-button" aria-label="Close Circle form" onClick={() => setCreating(false)}><X size={18} /></button></div>
          {createError && <p className="notice notice-danger" role="alert">{createError}</p>}
          <form onChange={(event) => setCreateFormValid(event.currentTarget.checkValidity())} onSubmit={async (event) => {
            event.preventDefault()
            if (!canCreate || submittedRules.length === 0) return
            const data = new FormData(event.currentTarget)
            setSubmitting(true)
            setCreateError('')
            try {
              const circleId = await createCircle({
                name: String(data.get('name') ?? ''),
                slug: String(data.get('slug') ?? ''),
                purpose: String(data.get('purpose') ?? ''),
                category: String(data.get('category') ?? ''),
                mode: String(data.get('mode') ?? 'online') as 'online' | 'in_person' | 'both',
                approximateArea: String(data.get('approximateArea') ?? '') || undefined,
                rules: submittedRules,
                iconStorageId: iconStorageId ?? undefined,
                coverStorageId: coverStorageId ?? undefined,
              })
              await navigate({ to: '/circles/$circleId', params: { circleId } })
            } catch (cause) {
              setCreateError(cause instanceof Error ? cause.message : 'The Circle could not be created.')
            } finally {
              setSubmitting(false)
            }
          }}>
            <div className="circle-form-grid">
              <label><span>Name</span><input className="field" name="name" required maxLength={80} placeholder="Cebu Coffee Friends" /></label>
              <label><span>URL slug</span><input className="field" name="slug" required maxLength={60} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="cebu-coffee-friends" /><small>Lowercase letters, numbers, and hyphens.</small></label>
              <label className="circle-form-wide"><span>Purpose</span><textarea className="field" name="purpose" required maxLength={500} placeholder="What brings this Circle together?" /></label>
              <label><span>Category</span><input className="field" name="category" required maxLength={60} placeholder="Coffee" /></label>
              <label><span>Mode</span><select className="field" name="mode" defaultValue="online"><option value="online">Online</option><option value="in_person">In person</option><option value="both">Online and in person</option></select></label>
              <label className="circle-form-wide"><span>Approximate area</span><input className="field" name="approximateArea" maxLength={80} placeholder="Cebu City or Online" /><small>Use a city or broad area. Do not enter a home or meeting address.</small></label>
              <div className="circle-form-wide circle-create-images">
                {(['icon', 'cover'] as const).map((kind) => {
                  const preview = kind === 'icon' ? iconPreview : coverPreview
                  return (
                    <label
                      key={kind}
                      className="circle-dropzone"
                      data-dragging={dragOver === kind}
                      onDragOver={(event) => { event.preventDefault(); setDragOver(kind) }}
                      onDragLeave={() => setDragOver((current) => current === kind ? null : current)}
                      onDrop={(event) => {
                        event.preventDefault()
                        setDragOver(null)
                        void uploadCreateImage(kind, event.dataTransfer.files?.[0] ?? null)
                      }}
                    >
                      <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={submitting} onChange={(event) => {
                        const file = event.currentTarget.files?.item?.(0) ?? null
                        void uploadCreateImage(kind, file)
                        event.currentTarget.value = ''
                      }} />
                      <span className="circle-dropzone-caption">{kind === 'icon' ? 'Icon' : 'Cover'} (optional)</span>
                      {preview
                        ? <img className={kind === 'icon' ? 'circle-icon-preview' : 'circle-cover-preview'} src={preview} alt={`${kind} preview`} />
                        : <span className="circle-dropzone-hint"><ImagePlus size={20} aria-hidden="true" /><span>{kind === 'icon' ? 'Drop the square icon here or click to browse.' : 'Drop the wide cover here or click to browse.'}</span></span>}
                      <small>JPEG, PNG, or WebP, 5 MB or smaller.</small>
                    </label>
                  )
                })}
              </div>
            </div>
            <fieldset className="circle-rule-picker">
              <legend>Circle rules</legend>
              <ol>
                {rules.map((rule, index) => (
                  <li key={index}>
                    <label className="sr-only" htmlFor={`circle-rule-${index}`}>Rule {index + 1}</label>
                    <input
                      id={`circle-rule-${index}`}
                      className="field"
                      value={rule}
                      maxLength={240}
                      placeholder="Write a rule for members"
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setRules((current) => current.map((item, ruleIndex) => ruleIndex === index ? value : item))
                      }}
                    />
                    <button type="button" className="btn btn-ghost" aria-label={`Remove rule ${index + 1}`} onClick={() => setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index))}>Remove</button>
                  </li>
                ))}
              </ol>
              <button type="button" className="btn btn-ghost circle-rule-add" onClick={() => setRules((current) => [...current, ''])}><Plus size={15} aria-hidden="true" /> Add rule</button>
            </fieldset>
            <div className="circle-form-actions"><button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn btn-self" disabled={!canCreate || !createFormValid || submittedRules.length === 0 || submitting}>{submitting ? 'Creating...' : 'Create Circle'}</button></div>
          </form>
        </section>
      )}

      {loading ? <div className="circle-state-card" role="status"><strong>Loading circles...</strong></div> : (
        <>
          <section className="circle-index-section" aria-labelledby="my-circles-title">
            <div className="circle-section-heading">
              <h2 id="my-circles-title">My circles</h2>
              <span className="tabular">{mineRows.length}</span>
            </div>
            {mineRows.length ? <div className="circle-index-list">{mineRows.map((circle) => <CircleRow key={circle._id} circle={circle} />)}</div> : (
              <div className="circle-state-card"><strong>You have not joined a Circle yet.</strong><p>Browse the active Circles below and request a place in one that fits.</p></div>
            )}
          </section>

          <section className="circle-index-section" aria-labelledby="discover-circles-title">
            <div className="circle-section-heading">
              <h2 id="discover-circles-title">Discover circles</h2>
              <span className="tabular">{available.length}</span>
            </div>
            {available.length ? <div className="circle-index-list">{available.map((circle) => <CircleRow key={circle._id} circle={circle} />)}</div> : (
              <div className="circle-state-card"><strong>No new Circles right now.</strong><p>Your joined Circles are listed above.</p></div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export function MyCirclesHomeModule() {
  const mine = useQuery(api.circles.mine)
  const active = (Array.isArray(mine) ? mine : []).filter((circle) => circle.membershipState === 'active').slice(0, 3)
  return (
    <section className="home-circles-module" aria-labelledby="home-circles-title">
      <div className="circle-section-heading"><h2 id="home-circles-title">My circles</h2><Link to="/circles">See all</Link></div>
      {mine === undefined ? <p role="status" className="text-meta">Loading circles...</p> : active.length === 0 ? <p>Join a Circle to see its active conversations here.</p> : <div>{active.map((circle) => <Link key={circle._id} to="/circles/$circleId" params={{ circleId: circle._id }}><CircleMarker circle={circle} /><span><strong>{circle.name}</strong><small>{circle.memberCount} members</small></span></Link>)}</div>}
    </section>
  )
}
