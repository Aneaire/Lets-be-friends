import { useMutation } from 'convex/react'
import { useState } from 'react'
import {
  activityCategories,
  activityCategoryOptions,
  friendStrengths,
  maximumActivityCategoryLength,
  maximumCompanionActivityCategories,
  validateActivityCategories,
} from '@lets-be-friends/shared'
import { api } from '../../../convex/_generated/api'
import {
  buildOnboardingApplicationPayload,
  defaultOnboardingApplicationValues,
  onboardingApplicationDefaults,
  onboardingApplicationStatusGuidance,
  onboardingApplicationStatusLabel,
  validateOnboardingApplication,
  type OnboardingApplicationMode,
} from './onboardingCompanionApplication'

export interface OnboardingApplicationStatus {
  status: string
  updatedAt?: number
}

export function OnboardingCompanionApplicationStep({
  application,
  viewerBio,
  viewerCategories,
  onSubmitted,
}: {
  application: OnboardingApplicationStatus | null | undefined
  viewerBio?: string | null
  viewerCategories?: string[] | null
  onSubmitted?: () => void
}) {
  const submit = useMutation(api.companions.submitApplication)
  const [values, setValues] = useState(() =>
    defaultOnboardingApplicationValues(viewerBio ?? null, viewerCategories ?? null),
  )
  const [customCategory, setCustomCategory] = useState('')
  const [customError, setCustomError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (application === undefined) {
    return <div className="empty-state">Loading your Companion application…</div>
  }

  if (application !== null || saved) {
    const status = application?.status ?? 'pending_review'
    return (
      <div className="onboarding-application-status" data-status={status}>
        <p>
          <span className="status-pill" data-tone={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>
            {onboardingApplicationStatusLabel(status)}
          </span>
        </p>
        <p className="text-body muted mt-2">{onboardingApplicationStatusGuidance(status)}</p>
        <p className="text-meta mt-2">
          Applying starts review. It does not guarantee approval. Admin review stays required before a profile can appear publicly.
        </p>
      </div>
    )
  }

  const setMode = (mode: OnboardingApplicationMode) =>
    setValues((current) => ({ ...current, mode }))

  const toggleStrength = (strength: string) =>
    setValues((current) => ({
      ...current,
      strengths: current.strengths.includes(strength)
        ? current.strengths.filter((item) => item !== strength)
        : [...current.strengths, strength],
    }))

  const toggleCategory = (category: string) =>
    setValues((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }))

  const addCustomCategory = () => {
    const result = validateActivityCategories(
      [...values.categories, customCategory],
      maximumCompanionActivityCategories,
    )
    if (!result.ok) {
      setCustomError(result.message)
      return
    }
    setValues((current) => ({ ...current, categories: result.value }))
    setCustomCategory('')
    setCustomError('')
  }

  const submitApplication = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    const validation = validateOnboardingApplication(values)
    if (!validation.ok) {
      setFormError(validation.message)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await submit(buildOnboardingApplicationPayload(values))
      setSaved(true)
      onSubmitted?.()
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Your Companion profile could not be submitted.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="onboarding-application-form mt-6" onSubmit={(event) => void submitApplication(event)}>
      <fieldset className="companion-mode-fieldset">
        <legend className="label">Session format</legend>
        <div className="companion-mode-options">
          {([
            ['both', 'Online and in-person'],
            ['online', 'Online only'],
            ['in_person', 'In-person only'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={values.mode === value} onClick={() => setMode(value)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field-row">
        <span className="label">Listed hourly rate <span className="label-aux">PHP</span></span>
        <input
          type="number"
          className="field"
          min={onboardingApplicationDefaults.rateMinPesos}
          max={onboardingApplicationDefaults.rateMaxPesos}
          step="0.01"
          required
          value={values.hourlyRatePesos}
          onChange={(event) => setValues((current) => ({ ...current, hourlyRatePesos: event.currentTarget.value }))}
        />
        <span className="field-row-help">You receive this amount for each completed hour. The member total includes the service fee.</span>
      </label>

      <label className="field-row">
        <span className="label">How can you help or spend the time? <span className="label-aux">40 to 500 characters</span></span>
        <textarea
          required
          minLength={onboardingApplicationDefaults.introMinLength}
          maxLength={onboardingApplicationDefaults.introMaxLength}
          className="field min-h-28"
          value={values.intro}
          onChange={(event) => setValues((current) => ({ ...current, intro: event.currentTarget.value }))}
          placeholder="For example: I can join a shopping trip, explain everyday technology, share local knowledge, or offer unhurried conversation."
        />
        <span className="field-row-help tabular">{values.intro.length}/500</span>
      </label>

      <label className="field-row">
        <span className="label">Tell members about yourself <span className="label-aux">optional, up to 500 characters</span></span>
        <textarea
          maxLength={onboardingApplicationDefaults.bioMaxLength}
          className="field min-h-24"
          value={values.bio}
          onChange={(event) => setValues((current) => ({ ...current, bio: event.currentTarget.value }))}
          placeholder="Something personal about your hobbies, family, or work."
        />
      </label>

      <fieldset className="companion-chip-group">
        <legend className="label">Strengths <span className="label-aux">choose at least one</span></legend>
        <div className="flex flex-wrap gap-2">
          {friendStrengths.map((strength) => {
            const selected = values.strengths.includes(strength)
            return (
              <button
                key={strength}
                type="button"
                className="chip"
                data-selected={selected}
                aria-pressed={selected}
                onClick={() => toggleStrength(strength)}
              >
                {strength}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="companion-chip-group">
        <legend className="label">Everyday help and activities <span className="label-aux">choose at least one</span></legend>
        <div className="flex flex-wrap gap-2">
          {activityCategoryOptions(values.categories).map((category) => {
            const selected = values.categories.includes(category)
            return (
              <button
                key={category}
                type="button"
                className="chip"
                data-selected={selected}
                aria-pressed={selected}
                disabled={!selected && values.categories.length >= maximumCompanionActivityCategories}
                onClick={() => toggleCategory(category)}
              >
                {category}
              </button>
            )
          })}
        </div>
        <div className="category-custom-entry mt-3">
          <label className="field-row">
            <span className="label">Add your own category</span>
            <input
              className="field"
              value={customCategory}
              maxLength={maximumActivityCategoryLength}
              disabled={values.categories.length >= maximumCompanionActivityCategories}
              onChange={(event) => {
                setCustomCategory(event.currentTarget.value)
                setCustomError('')
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                addCustomCategory()
              }}
              placeholder="For example, museum visits"
            />
          </label>
          <button
            type="button"
            className="btn btn-self btn-sm"
            disabled={values.categories.length >= maximumCompanionActivityCategories}
            onClick={addCustomCategory}
          >
            Add category
          </button>
        </div>
        {customError && <p className="field-row-help category-custom-error" role="alert">{customError}</p>}
        <p className="field-row-help">Initial list: {activityCategories.length} standard options. Your categories are reviewed before they appear publicly.</p>
      </fieldset>

      <label className="field-row">
        <span className="label">{values.mode === 'online' ? 'Timezone or broad region' : 'City'} <span className="label-aux">{values.mode === 'online' ? 'optional' : 'required'}</span></span>
        <input
          required={values.mode !== 'online'}
          className="field"
          value={values.city}
          onChange={(event) => setValues((current) => ({ ...current, city: event.currentTarget.value }))}
          placeholder={values.mode === 'online' ? 'For example, Philippines, GMT+8' : 'For example, Bacolor'}
        />
      </label>

      <label className="field-row">
        <span className="label">Boundaries <span className="label-aux">one per line</span></span>
        <textarea
          className="field min-h-24"
          value={values.boundariesText}
          onChange={(event) => setValues((current) => ({ ...current, boundariesText: event.currentTarget.value }))}
        />
      </label>

      <label className="field-row">
        <span className="label">Why do you want to earn with Let&apos;s Be Friends? <span className="label-aux">private, at least 20 characters</span></span>
        <textarea
          required
          minLength={onboardingApplicationDefaults.earningMotivationMinLength}
          maxLength={onboardingApplicationDefaults.earningMotivationMaxLength}
          className="field min-h-24"
          value={values.earningMotivation}
          onChange={(event) => setValues((current) => ({ ...current, earningMotivation: event.currentTarget.value }))}
          placeholder="Share why you want to earn as a Companion. Only the review team reads this."
        />
      </label>

      {formError && <p className="field-row-help category-custom-error" role="alert">{formError}</p>}

      <div className="notice notice-warning text-meta">
        <span className="notice-icon">i</span>
        <span>Sending starts profile review. Identity approval and profile approval are separate steps.</span>
      </div>

      <div className="mt-4">
        <button type="submit" className="btn btn-self" disabled={saving}>
          {saving ? 'Sending…' : 'Submit Companion application'}
        </button>
      </div>
    </form>
  )
}
