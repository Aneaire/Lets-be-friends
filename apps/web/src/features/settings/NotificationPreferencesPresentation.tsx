import { SettingsSection } from '../presentation/SettingsPresentation'
import {
  digestSummary,
  minuteToTimeInput,
  quietHoursSummary,
  timeInputToMinute,
  type NotificationPreferenceKey,
  type NotificationPreferencesPatch,
  type NotificationPreferencesView,
} from './notificationPreferences'

type PreferenceToggleRowProps = {
  id: string
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}

function PreferenceToggleRow({ id, label, description, checked, disabled, onChange }: PreferenceToggleRowProps) {
  const labelId = `${id}-label`

  return (
    <div className="settings-row settings-row-choice">
      <div className="settings-row-copy">
        <strong id={labelId}>{label}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        className="settings-toggle"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="settings-toggle-track" aria-hidden="true" />
        <span className="settings-toggle-state">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}

export type NotificationPreferencesPresentationProps = {
  preferences: NotificationPreferencesView
  pending?: NotificationPreferenceKey | ''
  error?: string
  onChange: (key: NotificationPreferenceKey, patch: NotificationPreferencesPatch) => void
}

export function NotificationPreferencesPresentation({
  preferences,
  pending = '',
  error = '',
  onChange,
}: NotificationPreferencesPresentationProps) {
  return (
    <SettingsSection
      headingId="notifications-heading"
      title="Notifications"
      description="Choose which social updates reach you. Changes save right away."
    >
      <p className="settings-note">
        Bookings, messages, and safety notices are always delivered. You cannot turn them off here.
      </p>

      <PreferenceToggleRow
        id="notifications-reactions"
        label="Reactions"
        description="Likes on your posts, comments, and ratings."
        checked={preferences.socialReactions}
        disabled={pending !== ''}
        onChange={(checked) => onChange('socialReactions', { socialReactions: checked })}
      />
      <PreferenceToggleRow
        id="notifications-comments"
        label="Comments and replies"
        description="New comments, replies, and mentions."
        checked={preferences.socialComments}
        disabled={pending !== ''}
        onChange={(checked) => onChange('socialComments', { socialComments: checked })}
      />
      <PreferenceToggleRow
        id="notifications-follows"
        label="New followers"
        description="When someone starts following you."
        checked={preferences.socialFollows}
        disabled={pending !== ''}
        onChange={(checked) => onChange('socialFollows', { socialFollows: checked })}
      />
      <PreferenceToggleRow
        id="notifications-circles"
        label="Circle activity"
        description="Replies, reactions, and mentions inside the Circles you joined."
        checked={preferences.circleActivity}
        disabled={pending !== ''}
        onChange={(checked) => onChange('circleActivity', { circleActivity: checked })}
      />
      <PreferenceToggleRow
        id="notifications-quiet-hours"
        label="Quiet hours"
        description={quietHoursSummary(preferences.quietHoursEnabled, preferences.quietHoursStartMinute, preferences.quietHoursEndMinute)}
        checked={preferences.quietHoursEnabled}
        disabled={pending !== ''}
        onChange={(checked) => onChange('quietHoursEnabled', { quietHoursEnabled: checked })}
      />
      <div className="settings-row settings-row-choice">
        <div className="settings-row-copy">
          <strong>Quiet hours window</strong>
          <span>Start and end follow your local time zone ({preferences.timeZone}).</span>
        </div>
        <div className="settings-time-row">
          <label className="settings-time-field">
            <span>Start time</span>
            <input
              type="time"
              className="field"
              value={minuteToTimeInput(preferences.quietHoursStartMinute)}
              aria-label="Quiet hours start time"
              disabled={!preferences.quietHoursEnabled || pending === 'quietHoursStartMinute'}
              onChange={(event) => {
                const minute = timeInputToMinute(event.currentTarget.value)
                if (minute === null) return
                onChange('quietHoursStartMinute', { quietHoursStartMinute: minute })
              }}
            />
          </label>
          <label className="settings-time-field">
            <span>End time</span>
            <input
              type="time"
              className="field"
              value={minuteToTimeInput(preferences.quietHoursEndMinute)}
              aria-label="Quiet hours end time"
              disabled={!preferences.quietHoursEnabled || pending === 'quietHoursEndMinute'}
              onChange={(event) => {
                const minute = timeInputToMinute(event.currentTarget.value)
                if (minute === null) return
                onChange('quietHoursEndMinute', { quietHoursEndMinute: minute })
              }}
            />
          </label>
        </div>
      </div>
      <PreferenceToggleRow
        id="notifications-digest"
        label="Daily digest"
        description={digestSummary(preferences.digestEnabled, preferences.digestHourMinute)}
        checked={preferences.digestEnabled}
        disabled={pending !== ''}
        onChange={(checked) => onChange('digestEnabled', { digestEnabled: checked })}
      />
      <div className="settings-row settings-row-choice">
        <div className="settings-row-copy">
          <strong>Digest time</strong>
          <span>One social summary each day in your local time zone ({preferences.timeZone}).</span>
        </div>
        <div className="settings-time-row">
          <label className="settings-time-field">
            <span>Digest time</span>
            <input
              type="time"
              className="field"
              value={minuteToTimeInput(preferences.digestHourMinute)}
              aria-label="Daily digest time"
              disabled={!preferences.digestEnabled || pending === 'digestHourMinute'}
              onChange={(event) => {
                const minute = timeInputToMinute(event.currentTarget.value)
                if (minute === null) return
                onChange('digestHourMinute', { digestHourMinute: minute })
              }}
            />
          </label>
        </div>
      </div>

      {error ? <p className="settings-error-note" role="alert">{error}</p> : null}
    </SettingsSection>
  )
}
