import { SignInButton, useAuth } from '@clerk/react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { ArrowLeft, Camera, Check, ClipboardCheck, FileText, LockKeyhole, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'

export type IdentityIntent = 'member' | 'companion_application'
export type IdentityReturnTo = '/app' | '/profile' | '/onboarding' | '/become-companion' | '/get-verified'
export type IdentityMobileReturnTo = 'profile' | 'companion'
type DocumentType = 'passport' | 'drivers_license' | 'national_id' | 'residence_permit' | 'other_government_id'
type CameraTarget = 'id_front' | 'id_back' | 'selfie'
type DetailStep = 2 | 3 | 4
type ExtractedFields = {
  fullLegalName?: string
  dateOfBirth?: string
  idType?: DocumentType
  idNumberLast4?: string
  expirationDate?: string
  nationality?: string
}

export function useIdentityVerification(intent: IdentityIntent = 'member') {
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)

  const begin = useCallback(async () => {
    setBusy(true)
    try {
      await navigate({
        to: '/verify-identity',
        search: { intent, returnTo: identityReturnPath(location.pathname, intent) },
      })
      return { mode: 'launch' as const }
    } finally {
      setBusy(false)
    }
  }, [intent, location.pathname, navigate])

  return { begin, busy, message: '', error: '' }
}

export function IdentityVerificationPage({ intent, returnTo, mobileReturn }: { intent: IdentityIntent; returnTo: IdentityReturnTo; mobileReturn?: IdentityMobileReturnTo }) {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const current = useQuery(api.identityRecords.current, isSignedIn ? {} : 'skip')
  const start = useMutation(api.identityRecords.start)
  const uploadImage = useAction(api.identityRecords.uploadImage)
  const extract = useAction(api.identityRecords.extract)
  const confirmFields = useMutation(api.identityRecords.confirmFields)
  const issueSelfieCaptureToken = useMutation(api.identityRecords.issueSelfieCaptureToken)
  const submit = useMutation(api.identityRecords.submit)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [selectedIdType, setSelectedIdType] = useState<DocumentType>('drivers_license')
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [processingConsent, setProcessingConsent] = useState(false)
  const [reviewConsent, setReviewConsent] = useState(false)
  const [fields, setFields] = useState<ExtractedFields>({})
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null)
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null)
  const [selfieSaved, setSelfieSaved] = useState(false)
  const [detailStep, setDetailStep] = useState<DetailStep | null>(null)
  const [working, setWorking] = useState(false)
  const [localError, setLocalError] = useState('')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const closeCamera = useCallback(() => {
    stopCamera()
    setCameraTarget(null)
  }, [stopCamera])

  useEffect(() => {
    const values = current?.confirmed ?? current?.extraction
    if (values) setFields({
      fullLegalName: values.fullLegalName,
      dateOfBirth: values.dateOfBirth,
      idType: values.idType,
      idNumberLast4: values.idNumberLast4,
      expirationDate: values.expirationDate,
      nationality: values.nationality,
    })
    if (current?.selectedIdType) setSelectedIdType(current.selectedIdType)
    setSelfieSaved(current?.imageKinds.includes('selfie') ?? false)
  }, [current])

  useEffect(() => {
    setDetailStep(null)
    setSelfieBlob(null)
    closeCamera()
  }, [closeCamera, current?._id])

  useEffect(() => () => stopCamera(), [stopCamera])

  const leavePage = () => {
    closeCamera()
    if (mobileReturn) {
      // Only the fixed letsbefriends deep links are ever used for the mobile
      // handoff return. Arbitrary redirects are never accepted.
      window.location.assign(`letsbefriends://${mobileReturn}`)
      return
    }
    void navigateToReturn(navigate, returnTo)
  }

  const fail = (error: unknown) => {
    setLocalError(error instanceof Error ? error.message : 'Identity verification could not continue.')
  }

  const openCamera = async (target: CameraTarget) => {
    setLocalError('')
    closeCamera()
    setCameraTarget(target)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('A camera-enabled browser is required to take this photo.')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: target === 'selfie' ? 'user' : { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      window.setTimeout(() => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        void videoRef.current.play()
      }, 0)
    } catch (error) {
      closeCamera()
      fail(error)
    }
  }

  const captureCameraImage = async () => {
    const target = cameraTarget
    const video = videoRef.current
    if (!target || !video?.videoWidth) {
      setLocalError('Wait for the camera preview before taking the photo.')
      return
    }
    setWorking(true)
    setLocalError('')
    try {
      const blob = await videoFrameToBlob(video)
      if (target === 'selfie') {
        setSelfieBlob(blob)
      } else {
        const file = new File([blob], target === 'id_front' ? 'id-front-camera.jpg' : 'id-back-camera.jpg', { type: 'image/jpeg' })
        if (target === 'id_front') setFront(file)
        else setBack(file)
      }
      closeCamera()
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }

  const uploadId = async () => {
    if (!front || !processingConsent) {
      setLocalError('Add the front of your ID and consent to secure AI processing first.')
      return
    }
    setWorking(true)
    setLocalError('')
    closeCamera()
    try {
      const started = await start({ reason: intent, selectedIdType })
      if (started.mode === 'approved') {
        leavePage()
        return
      }
      const identityRecordId = started.identityRecordId
      await uploadFile(uploadImage, identityRecordId, 'id_front', front)
      if (back) await uploadFile(uploadImage, identityRecordId, 'id_back', back)
      setFields(await extract({ identityRecordId, thirdPartyProcessingConsent: true }))
      setDetailStep(2)
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }

  const saveFieldsForReview = async () => {
    if (!current) return
    if (!selfieBlob && !selfieSaved) {
      setLocalError('Take a current selfie before saving these details.')
      setDetailStep(2)
      return
    }
    setWorking(true)
    setLocalError('')
    try {
      await confirmFields({
        identityRecordId: current._id,
        fullLegalName: fields.fullLegalName ?? '',
        dateOfBirth: fields.dateOfBirth ?? '',
        idType: fields.idType ?? selectedIdType,
        idNumberLast4: emptyToUndefined(fields.idNumberLast4),
        expirationDate: emptyToUndefined(fields.expirationDate),
        nationality: emptyToUndefined(fields.nationality),
      })
      if (selfieBlob && !selfieSaved) {
        const { token } = await issueSelfieCaptureToken({ identityRecordId: current._id })
        await uploadImage({ identityRecordId: current._id, kind: 'selfie', bytes: await selfieBlob.arrayBuffer(), contentType: 'image/jpeg', cameraCaptureToken: token })
        setSelfieSaved(true)
        setSelfieBlob(null)
      }
      setDetailStep(4)
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }

  const submitForReview = async () => {
    if (!current) return
    setWorking(true)
    setLocalError('')
    try {
      await submit({ identityRecordId: current._id, reviewConsent })
      closeCamera()
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }

  const startRenewal = async () => {
    setWorking(true)
    setLocalError('')
    try {
      const started = await start({ reason: 'reverification', selectedIdType })
      if (started.mode === 'started' || started.mode === 'continue') {
        setFront(null)
        setBack(null)
        setFields({})
        setDetailStep(null)
        setSelfieBlob(null)
        setSelfieSaved(false)
      }
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }

  if (!isSignedIn) {
    return (
      <main className="identity-page identity-page-gate">
        <section className="identity-gate-card">
          <ShieldCheck size={28} aria-hidden="true" />
          <p className="eyebrow">Private identity check</p>
          <h1 className="text-h1">Sign in to verify your identity.</h1>
          <p className="text-body muted">Your identity records stay connected to your member account and are never public.</p>
          <SignInButton mode="modal"><button type="button" className="btn btn-self">Sign in to continue</button></SignInButton>
        </section>
      </main>
    )
  }

  if (current === undefined) return <main className="identity-page"><div className="identity-loading">Preparing your private identity check...</div></main>

  const stage = current?.stage
  const showUpload = !current || stage === 'draft' || stage === 'failed' || stage === 'rejected'
  const showFields = stage === 'confirmation_required'
  const submitted = stage === 'ready_for_review' || stage === 'approved'
  const approved = stage === 'approved'
  const existingReviewReady = Boolean(current?.fieldsConfirmedAt && selfieSaved)
  const showReview = showFields && (detailStep === 4 || (detailStep === null && existingReviewReady))
  const showForm = showFields && !showReview && detailStep === 3
  const showSelfie = showFields && !showReview && !showForm
  const activeStep = submitted ? 5 : showReview ? 4 : showForm ? 3 : showSelfie ? 2 : 1
  const workTitle = approved
    ? 'Your identity is approved'
    : submitted
      ? 'Your check is with the safety team'
      : showReview
        ? 'Check every detail'
        : showForm
          ? 'Complete your details'
          : showSelfie
            ? 'Take a current selfie'
            : 'Choose your government ID'
  const workDescription = approved
    ? 'Your current identity approval is active.'
    : submitted
      ? 'No more action is needed right now.'
      : showReview
        ? 'Make sure everything is accurate before sending it to the safety team.'
        : showForm
          ? 'We filled what the ID reader found. Complete or correct the remaining fields.'
          : showSelfie
            ? 'Use the live camera so the safety team has a current photo on record.'
            : 'Upload a photo or use your camera. Keep all four corners visible.'

  return (
    <main className="identity-page">
      <div className="identity-page-shell">
        <nav className="identity-page-back" aria-label="Identity verification navigation">
          <button type="button" className="identity-back-link" onClick={leavePage}><ArrowLeft size={16} aria-hidden="true" />Back</button>
          <span><LockKeyhole size={14} aria-hidden="true" />Private access only</span>
        </nav>

        <div className="identity-page-grid">
          <aside className="identity-page-intro">
            <div>
              <p className="eyebrow">Identity verification</p>
              <h1 className="text-display">A careful check, before you connect.</h1>
              <p className="text-body muted">Confirm your identity in four clear steps. Nothing from this check appears on your public profile.</p>
            </div>

            <ol className="identity-step-rail" aria-label="Verification progress">
              <IdentityStep number="01" title="Government ID" detail="Upload or take a photo" state={stepState(1, activeStep)} icon={<FileText size={18} />} />
              <IdentityStep number="02" title="Current selfie" detail="Use the live camera" state={stepState(2, activeStep)} icon={<Camera size={18} />} />
              <IdentityStep number="03" title="Your details" detail="Complete the auto-filled form" state={stepState(3, activeStep)} icon={<ClipboardCheck size={18} />} />
              <IdentityStep number="04" title="Check details" detail="Review before sending" state={stepState(4, activeStep)} icon={<Check size={18} />} />
            </ol>

            <div className="identity-privacy-note">
              <ShieldCheck size={20} aria-hidden="true" />
              <div><strong>Built around restraint</strong><span>The AI receives the ID only. Your selfie stays in private storage for authorized safety review.</span></div>
            </div>
          </aside>

          <section className="identity-work-card" aria-labelledby="identity-work-title">
            <header className="identity-work-header">
              <span className="identity-step-label">{submitted ? 'Complete' : `Step ${Math.min(activeStep, 4)} of 4`}</span>
              <h2 id="identity-work-title" className="text-h1">{workTitle}</h2>
              <p className="text-meta">{workDescription}</p>
            </header>

            <div className="identity-work-body">
              {showUpload && (
                <>
                  {stage === 'failed' && <div className="notice notice-danger" role="alert">We could not read the previous image. Choose a clearer photo and try again.</div>}
                  <label className="field-row">
                    <span className="label">Government ID type</span>
                    <select className="field" value={selectedIdType} onChange={(event) => setSelectedIdType(event.currentTarget.value as DocumentType)}>
                      <option value="drivers_license">Driver's license</option>
                      <option value="passport">Passport</option>
                      <option value="national_id">National ID</option>
                      <option value="residence_permit">Residence permit</option>
                      <option value="other_government_id">Other government ID</option>
                    </select>
                  </label>

                  <div className="identity-file-grid">
                    <IdentityMediaInput id="identity-front" label="Front of ID" file={front} required onChange={setFront} onError={setLocalError} onUseCamera={() => void openCamera('id_front')} />
                    <IdentityMediaInput id="identity-back" label="Back of ID" file={back} onChange={setBack} onError={setLocalError} onUseCamera={() => void openCamera('id_back')} />
                  </div>

                  {(cameraTarget === 'id_front' || cameraTarget === 'id_back') && (
                    <IdentityCamera target={cameraTarget} videoRef={videoRef} working={working} onCapture={() => void captureCameraImage()} onCancel={closeCamera} />
                  )}

                  <label className="identity-consent-row">
                    <input type="checkbox" checked={processingConsent} onChange={(event) => setProcessingConsent(event.currentTarget.checked)} />
                    <span><strong>Allow secure field extraction</strong><small>I consent to sending only my ID image to OpenAI. Storage is disabled for the request, though applicable safety-log retention may still apply.</small></span>
                  </label>

                  <button type="button" className="btn btn-self btn-lg identity-primary-action" onClick={() => void uploadId()} disabled={working || !front || !processingConsent}>{working ? 'Reading your ID...' : 'Continue to current selfie'}</button>
                </>
              )}

              {stage === 'extracting' && <IdentityProcessing />}

              {showSelfie && (
                <>
                  <div className="identity-review-callout"><ShieldCheck size={18} aria-hidden="true" /><span>Your selfie is stored privately and is never sent to the AI field extractor.</span></div>
                  {!selfieBlob && !selfieSaved && cameraTarget !== 'selfie' && (
                    <button type="button" className="identity-camera-launch" onClick={() => void openCamera('selfie')}>
                      <span><Camera size={24} aria-hidden="true" /></span>
                      <strong>Open the selfie camera</strong>
                      <small>Center your face in the guide and use even lighting.</small>
                    </button>
                  )}
                  {cameraTarget === 'selfie' && (
                    <IdentityCamera target="selfie" videoRef={videoRef} working={working} onCapture={() => void captureCameraImage()} onCancel={closeCamera} />
                  )}
                  {(selfieBlob || selfieSaved) && (
                    <div className="identity-selfie-confirmed">
                      <span><Check size={18} aria-hidden="true" /></span>
                      <div><strong>Current selfie captured</strong><small>{selfieSaved ? 'The selfie is stored privately.' : 'The photo will be stored after you complete the next form.'}</small></div>
                    </div>
                  )}
                  {(selfieBlob || selfieSaved) && (
                    <div className="identity-action-pair">
                      {!selfieSaved && <button type="button" className="btn btn-secondary" onClick={() => { setSelfieBlob(null); void openCamera('selfie') }}><RefreshCw size={16} aria-hidden="true" />Retake selfie</button>}
                      <button type="button" className="btn btn-self btn-lg" onClick={() => setDetailStep(3)}>Continue to your details</button>
                    </div>
                  )}
                </>
              )}

              {showForm && (
                <>
                  <div className="identity-review-callout"><FileText size={18} aria-hidden="true" /><span>Some fields were filled from your ID. Complete any blanks and correct anything the reader missed.</span></div>
                  <div className="identity-fields-grid">
                    <IdentityField label="Full legal name" value={fields.fullLegalName} wide onChange={(value) => setFields((currentFields) => ({ ...currentFields, fullLegalName: value }))} />
                    <IdentityField label="Date of birth" type="date" value={fields.dateOfBirth} onChange={(value) => setFields((currentFields) => ({ ...currentFields, dateOfBirth: value }))} />
                    <IdentityField label="Last 4 ID characters" value={fields.idNumberLast4} maxLength={4} optional onChange={(value) => setFields((currentFields) => ({ ...currentFields, idNumberLast4: value }))} />
                    <IdentityField label="Expiration date" type="date" value={fields.expirationDate} required={requiresExpirationDate(fields.idType ?? selectedIdType)} optional={!requiresExpirationDate(fields.idType ?? selectedIdType)} onChange={(value) => setFields((currentFields) => ({ ...currentFields, expirationDate: value }))} />
                    <IdentityField label="Nationality" value={fields.nationality} optional onChange={(value) => setFields((currentFields) => ({ ...currentFields, nationality: value }))} />
                  </div>
                  <button type="button" className="btn btn-self btn-lg identity-primary-action" onClick={() => void saveFieldsForReview()} disabled={working}>{working ? 'Saving your details...' : 'Save and check details'}</button>
                </>
              )}

              {showReview && (
                <>
                  <dl className="identity-details-review">
                    <IdentityReviewItem label="Full legal name" value={fields.fullLegalName} wide />
                    <IdentityReviewItem label="Date of birth" value={fields.dateOfBirth} />
                    <IdentityReviewItem label="ID type" value={documentTypeLabel(fields.idType ?? selectedIdType)} />
                    <IdentityReviewItem label="Last 4 ID characters" value={fields.idNumberLast4} />
                    <IdentityReviewItem label="Expiration date" value={fields.expirationDate} />
                    <IdentityReviewItem label="Nationality" value={fields.nationality} />
                  </dl>
                  <button type="button" className="identity-edit-details" onClick={() => setDetailStep(3)}>Edit these details</button>
                  <label className="identity-consent-row">
                    <input type="checkbox" checked={reviewConsent} onChange={(event) => setReviewConsent(event.currentTarget.checked)} />
                    <span><strong>Allow safety review and retention</strong><small>I consent to storing these identity records for up to 730 days and allowing authorized reviewers to access them for verification or an active incident. A legal hold may extend retention.</small></span>
                  </label>
                  <button type="button" className="btn btn-self btn-lg identity-primary-action" onClick={() => void submitForReview()} disabled={working || !reviewConsent}>{working ? 'Sending for review...' : 'Send for safety review'}</button>
                </>
              )}

              {submitted && <div className="identity-submitted"><span><Check size={24} aria-hidden="true" /></span><h3 className="text-h2">{approved ? 'Identity approved' : 'Submitted securely'}</h3><p className="text-body muted">{approved ? 'Your current identity approval is active. You can renew it before it expires.' : 'A safety reviewer will make the final decision. Your booking access stays locked until approval.'}</p>{approved && <button type="button" className="btn btn-secondary btn-lg" onClick={() => void startRenewal()} disabled={working}>{working ? 'Starting a renewal...' : 'Renew identity check'}</button>}<button type="button" className="btn btn-self btn-lg" onClick={leavePage}>Return to your account</button></div>}
              {localError && <div className="notice notice-danger" role="alert">{localError}</div>}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function IdentityStep({ number, title, detail, state, icon }: { number: string; title: string; detail: string; state: 'complete' | 'active' | 'upcoming'; icon: React.ReactNode }) {
  return <li data-state={state}><span className="identity-step-marker">{state === 'complete' ? <Check size={16} aria-hidden="true" /> : icon}</span><span className="identity-step-copy"><small>{number}</small><strong>{title}</strong><span>{detail}</span></span></li>
}

function IdentityMediaInput({ id, label, file, required, onChange, onError, onUseCamera }: { id: string; label: string; file: File | null; required?: boolean; onChange: (file: File | null) => void; onError: (message: string) => void; onUseCamera: () => void }) {
  const updateFile = (file: File | null) => {
    if (file && file.size > 10 * 1024 * 1024) {
      onError('Choose an image smaller than 10 MB.')
      return
    }
    onError('')
    onChange(file)
  }
  return (
    <div className="identity-media-field">
      <span className="label">{label}{!required && <span className="label-aux">Optional</span>}</span>
      <div className="identity-media-choice">
        <span className="identity-media-status"><FileText size={20} aria-hidden="true" /><span><strong>{file ? file.name : 'No photo added'}</strong><small>{file ? formatFileSize(file.size) : 'JPEG, PNG, or WebP up to 10 MB'}</small></span></span>
        <div className="identity-media-actions">
          <label className="identity-media-button" htmlFor={id}><Upload size={16} aria-hidden="true" />Upload photo</label>
          <button type="button" className="identity-media-button" onClick={onUseCamera}><Camera size={16} aria-hidden="true" />Use camera</button>
        </div>
      </div>
      <input id={id} className="identity-file-input" type="file" accept="image/jpeg,image/png,image/webp" required={required} onChange={(event) => updateFile(event.currentTarget.files?.[0] ?? null)} />
    </div>
  )
}

function IdentityCamera({ target, videoRef, working, onCapture, onCancel }: { target: CameraTarget; videoRef: React.RefObject<HTMLVideoElement | null>; working: boolean; onCapture: () => void; onCancel: () => void }) {
  const selfie = target === 'selfie'
  const title = selfie ? 'Take a current selfie' : target === 'id_front' ? 'Take the front of your ID' : 'Take the back of your ID'
  const captureLabel = selfie ? 'Take selfie' : 'Take ID photo'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !working) onCancel()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel, working])

  return (
    <div
      className="identity-camera-takeover"
      data-camera-kind={selfie ? 'selfie' : 'document'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-camera-title"
      aria-describedby="identity-camera-instruction"
    >
      <header className="identity-camera-header">
        <button type="button" className="identity-camera-close" onClick={onCancel} disabled={working} autoFocus>
          <ArrowLeft size={19} aria-hidden="true" />
          <span>Back</span>
        </button>
        <div className="identity-camera-heading">
          <strong id="identity-camera-title">{title}</strong>
          <span>{selfie ? 'Use even light and look straight ahead' : 'Keep the card flat and the details readable'}</span>
        </div>
        <span className="identity-camera-private"><LockKeyhole size={14} aria-hidden="true" /><span>Private</span></span>
      </header>

      <div className="identity-camera-preview">
        <video ref={videoRef} playsInline muted aria-label={selfie ? 'Current selfie camera preview' : 'Government ID camera preview'} />
        <div className="identity-camera-guide" aria-hidden="true" />
        <p id="identity-camera-instruction" className="identity-camera-hint">
          {selfie ? 'Center your face inside the oval' : 'Fit all four corners inside the frame'}
        </p>
      </div>

      <footer className="identity-camera-toolbar">
        <span className="identity-camera-privacy-note"><LockKeyhole size={14} aria-hidden="true" />Only you and authorized safety reviewers can access this photo.</span>
        <button type="button" className="identity-camera-shutter" onClick={onCapture} disabled={working} aria-label={captureLabel}>
          <span className="identity-camera-shutter-ring" aria-hidden="true"><span /></span>
          <strong>{working ? 'Saving photo...' : captureLabel}</strong>
        </button>
        <span className="identity-camera-target">{selfie ? 'Current selfie' : target === 'id_front' ? 'Front of ID' : 'Back of ID'}</span>
      </footer>
    </div>
  )
}

function IdentityField({ label, value, onChange, type = 'text', maxLength, optional, required, wide }: { label: string; value?: string; onChange: (value: string) => void; type?: string; maxLength?: number; optional?: boolean; required?: boolean; wide?: boolean }) {
  return <label className="field-row" data-wide={wide || undefined}><span className="label">{label}{optional && <span className="label-aux">Optional</span>}{required && <span className="label-aux">Required</span>}</span><input className="field" type={type} value={value ?? ''} maxLength={maxLength} onChange={(event) => onChange(event.currentTarget.value)} /></label>
}

function IdentityReviewItem({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  return <div data-wide={wide || undefined}><dt>{label}</dt><dd>{value?.trim() || 'Not provided'}</dd></div>
}

function IdentityProcessing() {
  return <div className="identity-processing" role="status"><span className="identity-processing-mark"><FileText size={24} aria-hidden="true" /></span><h3 className="text-h2">Reading your ID</h3><p className="text-body muted">We are extracting only the fields needed for your next step. Keep this page open.</p></div>
}

function stepState(step: number, active: number): 'complete' | 'active' | 'upcoming' { return step < active ? 'complete' : step === active ? 'active' : 'upcoming' }
function identityReturnPath(pathname: string, intent: IdentityIntent): IdentityReturnTo { if (pathname === '/profile' || pathname === '/onboarding' || pathname === '/become-companion' || pathname === '/get-verified') return pathname; return intent === 'companion_application' ? '/become-companion' : '/app' }
function navigateToReturn(navigate: ReturnType<typeof useNavigate>, returnTo: IdentityReturnTo) { if (returnTo === '/profile') return navigate({ to: '/profile' }); if (returnTo === '/onboarding') return navigate({ to: '/onboarding' }); if (returnTo === '/become-companion') return navigate({ to: '/become-companion' }); if (returnTo === '/get-verified') return navigate({ to: '/get-verified' }); return navigate({ to: '/app', search: {} }) }
async function uploadFile(uploadImage: any, identityRecordId: any, kind: 'id_front' | 'id_back', file: File) { await uploadImage({ identityRecordId, kind, bytes: await file.arrayBuffer(), contentType: file.type }) }
function emptyToUndefined(value?: string) { const normalized = value?.trim(); return normalized ? normalized : undefined }
function formatFileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
function documentTypeLabel(value: DocumentType) { return ({ passport: 'Passport', drivers_license: "Driver's license", national_id: 'National ID', residence_permit: 'Residence permit', other_government_id: 'Other government ID' } as const)[value] }
function requiresExpirationDate(value: DocumentType) { return value === 'passport' || value === 'drivers_license' || value === 'residence_permit' }

async function videoFrameToBlob(video: HTMLVideoElement): Promise<Blob> {
  const maxSide = 2200
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The camera photo could not be captured.')
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error('The camera photo could not be captured.')
  return blob
}
