export function IdentityRetentionTerms() {
  return (
    <details className="identity-retention-terms">
      <summary>ID image storage terms for safety and future transactions</summary>
      <div>
        <p>
          These terms explain what ID images we keep, why we keep them for the safety and
          security of future transactions, and who can access them. They apply when a member
          submits a government ID and a current selfie for safety review.
        </p>
        <p>
          <strong>What we store.</strong> We store the front of the government ID, the back of
          the ID when provided, the current camera selfie, and the confirmed details (full legal
          name, date of birth, ID type, last 4 ID characters, expiration date, and nationality
          when provided).
        </p>
        <p>
          <strong>Why we store it.</strong> We store these records to complete safety review, to
          prevent fraud and repeat misuse, to support fair review of future booking reports and
          payment questions, and to keep a reliable record while a member books experiences or
          offers experiences as a Companion.
        </p>
        <p>
          <strong>How long we keep it.</strong> We keep ID images for up to 730 days from upload.
          Images are queued for automatic deletion after that period. An active incident review or
          a documented legal hold may extend retention in short extensions until the matter is closed.
        </p>
        <p>
          <strong>Who can access it.</strong> Only authorized safety reviewers and admins can
          access ID images. Access is allowed only for verification or for an active report about
          that member. Each image view is time limited and audit logged. The other person in a
          booking, conversation, or review cannot access ID images. Public profiles never show ID
          images or ID details.
        </p>
        <p>
          <strong>How we limit use.</strong> ID images are stored privately. Only the ID image is
          sent to the secure field reader with storage disabled for that request (applicable
          safety logs may still apply). The selfie stays in private storage and is never sent to
          the field reader. Selfies are not used as biometric proof. Every completed submission
          receives an explicit safety team decision.
        </p>
        <p>
          <strong>Consent and choices.</strong> Submitting for safety review requires this consent.
          Without it, the submission cannot proceed. A renewal creates a new record under the same
          terms. If approval expires, a new identity check is required before booking or offering
          experiences as a Companion.
        </p>
      </div>
    </details>
  )
}
