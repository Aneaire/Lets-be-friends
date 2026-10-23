import { Fragment } from 'react'
import {
  currentPolicyVersion,
  policyDocuments,
  privacyDocument,
  termsDocument,
} from '@lets-be-friends/shared'

export const unifiedPolicyVersion = currentPolicyVersion

// One list used by the remembered notice, onboarding footer, and settings so
// both documents keep the same titles and paths everywhere.
export function PolicyLinkList() {
  return (
    <span>
      {policyDocuments.map((document, index) => (
        <Fragment key={document.id}>
          {index > 0 ? ' · ' : null}
          <a href={document.path} target="_blank" rel="noopener noreferrer">{document.title}</a>
        </Fragment>
      ))}
    </span>
  )
}

export function AlreadyAcceptedNotice() {
  return (
    <div className="onboarding-terms mt-3">
      <div>
        <p>
          <strong>You already accepted the current Terms, Privacy Policy, and identity terms (version {unifiedPolicyVersion}).</strong>{' '}
          No need to accept again. Finishing keeps your original acceptance date.
        </p>
        <p>
          <PolicyLinkList />
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
  const choices = [
    { document: termsDocument, checked: termsChecked, onChange: onTermsChange },
    { document: privacyDocument, checked: privacyChecked, onChange: onPrivacyChange },
  ]

  return (
    <>
      {choices.map(({ document, checked, onChange }) => (
        <div key={document.id} className="onboarding-consent-list mt-4">
          <div className="onboarding-consent-row">
            <input
              id={`onboarding-accept-${document.id}`}
              type="checkbox"
              aria-label={document.acceptanceLabel}
              checked={checked}
              disabled={disabled}
              onChange={(event) => onChange(event.currentTarget.checked)}
            />
            <span>
              <label htmlFor={`onboarding-accept-${document.id}`}>{document.acceptancePrefix}</label>
              <a href={document.path} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
                {document.title}
              </a>
            </span>
          </div>
        </div>
      ))}
    </>
  )
}
