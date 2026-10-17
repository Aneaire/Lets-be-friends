import {
  currentPolicyVersion,
  privacyAcceptanceLabel,
  privacyPath,
  termsAcceptanceLabel,
  termsPath,
} from '@lets-be-friends/shared'

export const unifiedPolicyVersion = currentPolicyVersion

export function AlreadyAcceptedNotice() {
  return (
    <div className="onboarding-terms mt-3">
      <div>
        <p>
          <strong>You already accepted the current Terms, Privacy Policy, and identity terms (version {unifiedPolicyVersion}).</strong>{' '}
          No need to accept again. Finishing keeps your original acceptance date.
        </p>
        <p>
          <a href={termsPath} target="_blank" rel="noopener noreferrer">Terms and Conditions</a> · <a href={privacyPath} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}

// The production Step 5 acceptance: two independently controlled checkboxes
// with document links that open in a new tab and never toggle the checkbox.
export function AcceptanceCheckboxes({
  termsChecked,
  privacyChecked,
  onTermsChange,
  onPrivacyChange,
  disabled = false,
}: {
  termsChecked: boolean
  privacyChecked: boolean
  onTermsChange: (checked: boolean) => void
  onPrivacyChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="onboarding-consent-list mt-4">
        <div className="onboarding-consent-row">
          <input
            id="onboarding-accept-terms"
            type="checkbox"
            aria-label={termsAcceptanceLabel}
            checked={termsChecked}
            disabled={disabled}
            onChange={(event) => onTermsChange(event.currentTarget.checked)}
          />
          <span>
            <label htmlFor="onboarding-accept-terms">{termsAcceptanceLabel.split('Terms and Conditions')[0]}</label>
            <a href={termsPath} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
              Terms and Conditions
            </a>
          </span>
        </div>
      </div>
      <div className="onboarding-consent-list mt-4">
        <div className="onboarding-consent-row">
          <input
            id="onboarding-accept-privacy"
            type="checkbox"
            aria-label={privacyAcceptanceLabel}
            checked={privacyChecked}
            disabled={disabled}
            onChange={(event) => onPrivacyChange(event.currentTarget.checked)}
          />
          <span>
            <label htmlFor="onboarding-accept-privacy">{privacyAcceptanceLabel.split('Privacy Policy')[0]}</label>
            <a href={privacyPath} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
              Privacy Policy
            </a>
          </span>
        </div>
      </div>
    </>
  )
}
