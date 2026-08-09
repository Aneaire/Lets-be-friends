import { useAction, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'

type IdentityIntent = 'member' | 'host_application'
type DocumentType = 'passport' | 'drivers_license' | 'national_id' | 'residence_permit' | 'other_government_id'
type ExtractedFields = {
  fullLegalName?: string
  dateOfBirth?: string
  idType?: DocumentType
  idNumberLast4?: string
  expirationDate?: string
  nationality?: string
}

export function useIdentityVerification(intent: IdentityIntent = 'member') {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const begin = useCallback(async () => {
    setBusy(true)
    setMessage('')
    setError('')
    setOpen(true)
    setBusy(false)
    return { mode: 'launch' as const }
  }, [])

  const complete = useCallback(() => {
    setOpen(false)
    setMessage('Your identity records were submitted for safety review.')
  }, [])

  return {
    begin,
    busy,
    message,
    error,
    dialog: open ? <IdentityVerificationDialog intent={intent} onClose={() => setOpen(false)} onComplete={complete} onError={setError} /> : null,
  }
}

function IdentityVerificationDialog({ intent, onClose, onComplete, onError }: { intent: IdentityIntent; onClose: () => void; onComplete: () => void; onError: (message: string) => void }) {
  const current = useQuery(api.identityRecords.current, {})
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
  const [cameraOpen, setCameraOpen] = useState(false)
  const [selfieSaved, setSelfieSaved] = useState(false)
  const [working, setWorking] = useState(false)
  const [localError, setLocalError] = useState('')

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

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

  useEffect(() => () => stopCamera(), [])

  const fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Identity verification could not continue.'
    setLocalError(message)
    onError(message)
  }

  const uploadId = async () => {
    if (!front || !processingConsent) {
      setLocalError('Choose the front of your ID and consent to secure AI processing first.')
      return
    }
    setWorking(true)
    setLocalError('')
    try {
      const started = await start({ reason: intent, selectedIdType })
      if (started.mode === 'approved') {
        onComplete()
        return
      }
      const identityRecordId = started.identityRecordId
      await uploadFile(uploadImage, identityRecordId, 'id_front', front)
      if (back) await uploadFile(uploadImage, identityRecordId, 'id_back', back)
      const result = await extract({ identityRecordId, thirdPartyProcessingConsent: true })
      setFields(result)
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }

  const saveFieldsAndOpenCamera = async () => {
    if (!current) return
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
      await openCamera()
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('A camera-enabled browser is required for the current selfie')
    stopCamera()
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    streamRef.current = stream
    setCameraOpen(true)
    window.setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        void videoRef.current.play()
      }
    }, 0)
  }

  const captureSelfie = async () => {
    if (!current || !videoRef.current || !videoRef.current.videoWidth) return
    setWorking(true)
    setLocalError('')
    try {
      const { token } = await issueSelfieCaptureToken({ identityRecordId: current._id })
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('The selfie could not be captured')
      context.drawImage(video, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('The selfie could not be captured')
      await uploadImage({ identityRecordId: current._id, kind: 'selfie', bytes: await blob.arrayBuffer(), contentType: 'image/jpeg', cameraCaptureToken: token })
      setSelfieSaved(true)
      stopCamera()
      setCameraOpen(false)
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
      stopCamera()
      onComplete()
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }

  const stage = current?.stage
  const showUpload = !current || stage === 'draft' || stage === 'failed'
  const showFields = stage === 'confirmation_required'
  const submitted = stage === 'ready_for_review' || stage === 'approved'

  return (
    <div className="booking-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose() }}>
      <section className="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="identity-dialog-title">
        <header className="booking-dialog-header">
          <div>
            <p className="eyebrow">Private identity check</p>
            <h2 id="identity-dialog-title" className="text-h2 mt-1">Confirm your identity</h2>
          </div>
          <button type="button" className="social-icon-button booking-dialog-close" aria-label="Close identity check" onClick={onClose} disabled={working}>×</button>
        </header>
        <div className="booking-dialog-body">
          <p className="text-meta">Your ID is used to extract editable details. Your current camera selfie is stored privately for safety and incident review. It is not sent to the AI, face matched, or treated as biometric liveness proof.</p>

          {showUpload && (
            <>
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
              <label className="field-row"><span className="label">Front of ID</span><input className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFront(event.currentTarget.files?.[0] ?? null)} /></label>
              <label className="field-row"><span className="label">Back of ID (optional)</span><input className="field" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setBack(event.currentTarget.files?.[0] ?? null)} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={processingConsent} onChange={(event) => setProcessingConsent(event.currentTarget.checked)} /><span>I consent to sending only my ID image to OpenAI for field extraction. The request is configured with storage disabled, but OpenAI may retain safety logs under its applicable data policy.</span></label>
              <button type="button" className="btn btn-self" onClick={() => void uploadId()} disabled={working || !front || !processingConsent}>{working ? 'Reading ID...' : 'Upload and read ID'}</button>
            </>
          )}

          {stage === 'extracting' && <div className="notice" role="status">Reading the ID image...</div>}

          {showFields && (
            <>
              <div className="notice" role="status">Review every field. AI extraction can make mistakes.</div>
              <IdentityField label="Full legal name" value={fields.fullLegalName} onChange={(value) => setFields((currentFields) => ({ ...currentFields, fullLegalName: value }))} />
              <IdentityField label="Date of birth" type="date" value={fields.dateOfBirth} onChange={(value) => setFields((currentFields) => ({ ...currentFields, dateOfBirth: value }))} />
              <IdentityField label="Last 4 ID characters (optional)" value={fields.idNumberLast4} maxLength={4} onChange={(value) => setFields((currentFields) => ({ ...currentFields, idNumberLast4: value }))} />
              <IdentityField label="Expiration date (optional)" type="date" value={fields.expirationDate} onChange={(value) => setFields((currentFields) => ({ ...currentFields, expirationDate: value }))} />
              <IdentityField label="Nationality (optional)" value={fields.nationality} onChange={(value) => setFields((currentFields) => ({ ...currentFields, nationality: value }))} />
              {!cameraOpen && !selfieSaved && <button type="button" className="btn btn-self" onClick={() => void saveFieldsAndOpenCamera()} disabled={working}>{working ? 'Saving...' : 'Confirm details and open camera'}</button>}
              {cameraOpen && <><video ref={videoRef} playsInline muted className="w-full" aria-label="Current selfie camera preview" /><button type="button" className="btn btn-self" onClick={() => void captureSelfie()} disabled={working}>{working ? 'Saving selfie...' : 'Take current selfie'}</button></>}
              {selfieSaved && <div className="notice notice-success" role="status">Current selfie saved privately.</div>}
              {selfieSaved && <label className="checkbox-row"><input type="checkbox" checked={reviewConsent} onChange={(event) => setReviewConsent(event.currentTarget.checked)} /><span>I consent to storing these identity records for up to 730 days and allowing authorized safety reviewers to access them for verification or an active incident. A legal hold may extend retention.</span></label>}
              {selfieSaved && <button type="button" className="btn btn-self" onClick={() => void submitForReview()} disabled={working || !reviewConsent}>{working ? 'Submitting...' : 'Submit for safety review'}</button>}
            </>
          )}

          {submitted && <div className="notice notice-success" role="status">Identity records submitted. A safety reviewer will make the final decision.</div>}
          {localError && <div className="notice notice-danger" role="alert"><span>{localError}</span></div>}
        </div>
      </section>
    </div>
  )
}

function IdentityField({ label, value, onChange, type = 'text', maxLength }: { label: string; value?: string; onChange: (value: string) => void; type?: string; maxLength?: number }) {
  return <label className="field-row"><span className="label">{label}</span><input className="field" type={type} value={value ?? ''} maxLength={maxLength} onChange={(event) => onChange(event.currentTarget.value)} /></label>
}

async function uploadFile(uploadImage: any, identityRecordId: any, kind: 'id_front' | 'id_back', file: File) {
  await uploadImage({ identityRecordId, kind, bytes: await file.arrayBuffer(), contentType: file.type })
}

function emptyToUndefined(value?: string) { const normalized = value?.trim(); return normalized ? normalized : undefined }
