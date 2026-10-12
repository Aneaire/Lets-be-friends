import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { CircleDot, ImagePlus, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { CircleCard, CircleHomeCard } from '../presentation/CircleCards'
import { uploadCircleImage } from './CircleWorkspacePage'

const CIRCLE_CREATE_DRAFT_KEY = 'lets-be-friends-circle-create-draft-v1'
const circleSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type CircleMode = 'online' | 'in_person' | 'both'

type CircleCreateDraft = {
  name: string
  slug: string
  slugEdited: boolean
  purpose: string
  category: string
  mode: CircleMode
  approximateArea: string
  rules: string[]
}

const emptyCircleCreateDraft: CircleCreateDraft = {
  name: '',
  slug: '',
  slugEdited: false,
  purpose: '',
  category: '',
  mode: 'online',
  approximateArea: '',
  rules: [''],
}

function readCircleCreateDraft(): CircleCreateDraft {
  if (typeof window === 'undefined') return emptyCircleCreateDraft
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(CIRCLE_CREATE_DRAFT_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return emptyCircleCreateDraft
    const saved = value as Record<string, unknown>
    const name = typeof saved.name === 'string' ? saved.name.slice(0, 80) : ''
    const slug = typeof saved.slug === 'string' ? filterCircleSlug(saved.slug) : ''
    const purpose = typeof saved.purpose === 'string' ? saved.purpose.slice(0, 500) : ''
    const category = typeof saved.category === 'string' ? saved.category.slice(0, 60) : ''
    const approximateArea = typeof saved.approximateArea === 'string' ? saved.approximateArea.slice(0, 80).replace(/[\r\n]/g, ' ') : ''
    const mode = saved.mode === 'in_person' || saved.mode === 'both' ? saved.mode : 'online'
    const rules = Array.isArray(saved.rules)
      ? saved.rules.filter((rule): rule is string => typeof rule === 'string').slice(0, 20).map((rule) => rule.slice(0, 240))
      : []
    return {
      name,
      slug,
      slugEdited: slug.length > 0 && (typeof saved.slugEdited === 'boolean' ? saved.slugEdited : true),
      purpose,
      category,
      mode,
      approximateArea,
      rules: rules.length > 0 ? rules : [''],
    }
  } catch {
    return emptyCircleCreateDraft
  }
}

function writeCircleCreateDraft(draft: CircleCreateDraft) {
  if (typeof window === 'undefined') return
  const hasContent = Boolean(
    draft.name || draft.slug || draft.purpose || draft.category || draft.approximateArea || draft.mode !== 'online' || draft.rules.some((rule) => rule),
  )
  try {
    if (hasContent) window.localStorage.setItem(CIRCLE_CREATE_DRAFT_KEY, JSON.stringify(draft))
    else window.localStorage.removeItem(CIRCLE_CREATE_DRAFT_KEY)
  } catch {
    // Draft persistence should never prevent Circle creation.
  }
}

function clearCircleCreateDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CIRCLE_CREATE_DRAFT_KEY)
  } catch {
    // Storage access should never prevent Circle creation.
  }
}

function slugifyCircleName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

function filterCircleSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
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
  const [circleName, setCircleName] = useState('')
  const [circleSlug, setCircleSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [circlePurpose, setCirclePurpose] = useState('')
  const [circleCategory, setCircleCategory] = useState('')
  const [circleMode, setCircleMode] = useState<CircleMode>('online')
  const [circleApproximateArea, setCircleApproximateArea] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [iconStorageId, setIconStorageId] = useState<Id<'_storage'> | null>(null)
  const [coverStorageId, setCoverStorageId] = useState<Id<'_storage'> | null>(null)
  const [iconPreview, setIconPreview] = useState<string | undefined>()
  const [coverPreview, setCoverPreview] = useState<string | undefined>()
  const [dragOver, setDragOver] = useState<'icon' | 'cover' | null>(null)
  const generateCreateUploadUrl = useMutation(api.circles.generateCreateImageUploadUrl)

  useEffect(() => {
    const draft = readCircleCreateDraft()
    setCircleName(draft.name)
    setCircleSlug(draft.slug)
    setSlugEdited(draft.slugEdited)
    setCirclePurpose(draft.purpose)
    setCircleCategory(draft.category)
    setCircleMode(draft.mode)
    setCircleApproximateArea(draft.approximateArea)
    setRules(draft.rules)
    setDraftReady(true)
  }, [])

  useEffect(() => {
    if (!draftReady) return
    writeCircleCreateDraft({
      name: circleName,
      slug: circleSlug,
      slugEdited,
      purpose: circlePurpose,
      category: circleCategory,
      mode: circleMode,
      approximateArea: circleApproximateArea,
      rules,
    })
  }, [circleApproximateArea, circleCategory, circleMode, circleName, circlePurpose, circleSlug, draftReady, rules, slugEdited])

  function resetCreateForm() {
    setCreateError('')
    setRules([''])
    setCircleName('')
    setCircleSlug('')
    setSlugEdited(false)
    setCirclePurpose('')
    setCircleCategory('')
    setCircleMode('online')
    setCircleApproximateArea('')
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
  const missingCreateRequirements = [
    !circleName.trim() ? 'Name' : null,
    !circleSlugPattern.test(circleSlug) ? (circleSlug ? 'a valid URL slug' : 'URL slug') : null,
    !circlePurpose.trim() ? 'Purpose' : null,
    !circleCategory.trim() ? 'Category' : null,
    submittedRules.length === 0 ? 'at least one Circle rule' : null,
  ].filter((requirement): requirement is string => requirement !== null)
  const createReady = canCreate && missingCreateRequirements.length === 0

  return (
    <main className="circles-index-page">
      <header className="circles-index-header">
        <div>
          <span className="eyebrow">Shared interests</span>
          <h1>Circles</h1>
          <p>Find a familiar group, follow the conversation, and get to know people at your own pace.</p>
        </div>
        <div className="circle-index-header-actions">
          {canCreate ? <button type="button" className="btn btn-self" onClick={() => { setCreateError(''); setCreating(true) }}><Plus size={16} aria-hidden="true" /> Create Circle</button> : needsVerification ? <Link to="/verify-identity" search={{ intent: 'member', returnTo: '/profile' }} className="btn btn-self-quiet">Verify to create a Circle</Link> : null}
          <CircleDot size={42} strokeWidth={1.25} aria-hidden="true" />
        </div>
      </header>

      {eligibility && !eligibility.eligible && <p className="circle-create-requirement" role="status">{needsVerification ? 'Current identity verification is required before you can create and host a Circle.' : 'Your account role is not eligible to create or host a Circle.'}</p>}
      {creating && (
        <section className="circle-create-panel" aria-labelledby="create-circle-title">
          <div className="circle-create-heading"><div><span className="eyebrow">Host a community</span><h2 id="create-circle-title">Create a Circle</h2></div><button type="button" className="icon-button" aria-label="Close Circle form" onClick={() => setCreating(false)}><X size={18} /></button></div>
          <p className="circle-create-draft-note">Your form details are saved on this device. If you add images, select them again when you return.</p>
          {createError && <p className="notice notice-danger" role="alert">{createError}</p>}
          <form onSubmit={async (event) => {
            event.preventDefault()
            if (!createReady) return
            setSubmitting(true)
            setCreateError('')
            try {
              const circleId = await createCircle({
                name: circleName,
                slug: circleSlug,
                purpose: circlePurpose,
                category: circleCategory,
                mode: circleMode,
                approximateArea: circleApproximateArea || undefined,
                rules: submittedRules,
                iconStorageId: iconStorageId ?? undefined,
                coverStorageId: coverStorageId ?? undefined,
              })
              clearCircleCreateDraft()
              resetCreateForm()
              await navigate({ to: '/circles/$circleId', params: { circleId } })
            } catch (cause) {
              setCreateError(cause instanceof Error ? cause.message : 'The Circle could not be created.')
            } finally {
              setSubmitting(false)
            }
          }}>
            <div className="circle-form-grid">
              <label><span>Name</span><input className="field" name="name" required maxLength={80} placeholder="Cebu Coffee Friends" value={circleName} onChange={(event) => {
                const value = event.currentTarget.value
                setCircleName(value)
                if (!slugEdited) {
                  const generatedSlug = slugifyCircleName(value)
                  const slugInput = event.currentTarget.form?.elements.namedItem('slug')
                  if (slugInput instanceof HTMLInputElement) slugInput.value = generatedSlug
                  setCircleSlug(generatedSlug)
                }
              }} /></label>
              <label><span>URL slug</span><input className="field" name="slug" required maxLength={60} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="cebu-coffee-friends" value={circleSlug} onChange={(event) => {
                const value = filterCircleSlug(event.currentTarget.value)
                event.currentTarget.value = value
                setCircleSlug(value)
                setSlugEdited(value.length > 0)
              }} /><small>Lowercase letters, numbers, and hyphens.</small></label>
              <label className="circle-form-wide"><span>Purpose</span><textarea className="field" name="purpose" required maxLength={500} placeholder="What brings this Circle together?" value={circlePurpose} onChange={(event) => setCirclePurpose(event.currentTarget.value)} /></label>
              <label><span>Category</span><input className="field" name="category" required maxLength={60} placeholder="Coffee" value={circleCategory} onChange={(event) => setCircleCategory(event.currentTarget.value)} /></label>
              <label><span>Mode</span><select className="field" name="mode" value={circleMode} onChange={(event) => setCircleMode(event.currentTarget.value as CircleMode)}><option value="online">Online</option><option value="in_person">In person</option><option value="both">Online and in person</option></select></label>
              <label className="circle-form-wide"><span>Approximate area</span><input className="field" name="approximateArea" maxLength={80} placeholder="Cebu City or Online" value={circleApproximateArea} onChange={(event) => setCircleApproximateArea(event.currentTarget.value)} /><small>Use a city or broad area. Do not enter a home or meeting address.</small></label>
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
            <div id="circle-create-readiness" className="circle-create-readiness" data-ready={createReady} role="status" aria-live="polite" aria-atomic="true">
              <strong>{createReady ? 'Ready to create' : 'Complete the required details'}</strong>
              <p>{createReady ? 'Everything required is filled in. You can create your Circle now.' : `Still needed: ${missingCreateRequirements.join(', ')}.`}</p>
            </div>
            <div className="circle-form-actions"><button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn btn-self" aria-describedby="circle-create-readiness" disabled={!createReady || submitting}>{submitting ? 'Creating...' : 'Create Circle'}</button></div>
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
            {mineRows.length ? <div className="circle-index-list">{mineRows.map((circle) => <CircleCard key={circle._id} link={<Link to="/circles/$circleId" params={{ circleId: circle._id }} />} circle={circle} />)}</div> : (
              <div className="circle-state-card"><strong>You have not joined a Circle yet.</strong><p>Browse the active Circles below and request a place in one that fits.</p></div>
            )}
          </section>

          <section className="circle-index-section" aria-labelledby="discover-circles-title">
            <div className="circle-section-heading">
              <h2 id="discover-circles-title">Discover circles</h2>
              <span className="tabular">{available.length}</span>
            </div>
            {available.length ? <div className="circle-index-list">{available.map((circle) => <CircleCard key={circle._id} link={<Link to="/circles/$circleId" params={{ circleId: circle._id }} />} circle={circle} />)}</div> : (
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
      {mine === undefined ? <p role="status" className="text-meta">Loading circles...</p> : active.length === 0 ? <p>Join a Circle to see its active conversations here.</p> : <div>{active.map((circle) => <CircleHomeCard key={circle._id} link={<Link to="/circles/$circleId" params={{ circleId: circle._id }} />} circle={circle} />)}</div>}
    </section>
  )
}
