import { activityCategories, maximumCompanionActivityCategories } from '@lets-be-friends/shared'
import { Input, Textarea } from '../../design-system/atoms/Field'
import { ActivityCategoryPicker } from './ActivityCategoryPicker'
import {
  companionProfileDefaults,
  formatPhpFromPesos,
  type CompanionProfileMode,
  type CompanionProfileValues,
} from './companionProfileForm'

const modeOptions = [
  ['both', 'Online and in-person'],
  ['online', 'Online only'],
  ['in_person', 'In-person only'],
] as const

// Shared field set for both the onboarding Companion step and the Settings
// editor, so the two surfaces always collect the same details. It renders only
// inputs; each caller owns submit behavior and location comes from onboarding.
export function CompanionProfileFields({
  values,
  onChange,
  selectedCategories,
  onCategoriesChange,
}: {
  values: CompanionProfileValues
  onChange: (patch: Partial<CompanionProfileValues>) => void
  selectedCategories: string[]
  onCategoriesChange: (categories: string[]) => void
}) {
  return (
    <>
      <fieldset className="companion-mode-fieldset">
        <legend className="label">Session format</legend>
        <div className="companion-mode-options">
          {modeOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={values.mode === value}
              onClick={() => onChange({ mode: value as CompanionProfileMode })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field-row">
        <span className="label">Listed hourly rate <span className="label-aux">PHP</span></span>
        <Input
          type="number"
          min={companionProfileDefaults.rateMinPesos}
          max={companionProfileDefaults.rateMaxPesos}
          step="0.01"
          required
          value={values.hourlyRatePesos}
          onChange={(event) => onChange({ hourlyRatePesos: event.currentTarget.value })}
        />
        <span className="field-row-help">You receive {formatPhpFromPesos(values.hourlyRatePesos)} for each completed hour. The member&apos;s final booking total includes the service fee.</span>
      </label>

      <label className="field-row">
        <span className="label">Tell me about yourself (Bio) <span className="label-aux">required, up to 500 characters</span></span>
        <Textarea
          required
          maxLength={companionProfileDefaults.bioMaxLength}
          value={values.bio}
          onChange={(event) => onChange({ bio: event.currentTarget.value })}
          className="min-h-24"
          placeholder="For example: I can help you practice a new language, and I make everyday errands more fun."
          aria-describedby="companion-bio-help companion-bio-count"
        />
        <span className="companion-field-help-row">
          <span id="companion-bio-help" className="field-row-help">This updates your member profile bio and appears on your public profile.</span>
          <span id="companion-bio-count" className="field-row-help tabular">{values.bio.length}/500</span>
        </span>
      </label>

      <label className="field-row">
        <span className="label">What work or skills could you share? <span className="label-aux">required, 40 to 500 characters</span></span>
        <Textarea
          required
          minLength={companionProfileDefaults.introMinLength}
          maxLength={companionProfileDefaults.introMaxLength}
          value={values.intro}
          onChange={(event) => onChange({ intro: event.currentTarget.value })}
          className="min-h-28"
          placeholder="For example: I am good with spreadsheets, I teach guitar, or I can help with everyday errands."
          aria-describedby="companion-skills-help companion-skills-count"
        />
        <span className="companion-field-help-row">
          <span id="companion-skills-help" className="field-row-help">This becomes the invitation members read. Keep it specific, and avoid romantic, dating, or transactional framing.</span>
          <span id="companion-skills-count" className="field-row-help tabular">{values.intro.length}/500</span>
        </span>
      </label>

      <label className="field-row">
        <span className="label">{values.mode === 'online' ? 'Timezone or broad region' : 'City'} <span className="label-aux">{values.mode === 'online' ? 'optional' : 'required'}</span></span>
        <Input
          required={values.mode !== 'online'}
          value={values.city}
          onChange={(event) => onChange({ city: event.currentTarget.value })}
          placeholder={values.mode === 'online' ? 'For example, Philippines, GMT+8' : 'For example, Bacolor'}
        />
        <span className="field-row-help">Nearby discovery uses the rounded location you saved during setup. This label is what members read.</span>
      </label>

      <ActivityCategoryPicker
        values={activityCategories}
        selected={selectedCategories}
        setSelected={onCategoriesChange}
        maximum={maximumCompanionActivityCategories}
      />
    </>
  )
}
