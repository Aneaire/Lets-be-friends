import { useAction } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'

type IdentityIntent = 'member' | 'host_application'
type PersonaClientHandle = { open: () => void; destroy: () => void }

export function useIdentityVerification(intent: IdentityIntent = 'member') {
  const startInquiry = useAction(api.persona.startInquiry)
  const clientRef = useRef<PersonaClientHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => () => clientRef.current?.destroy(), [])

  const begin = useCallback(async () => {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const result = await startInquiry({ intent })
      if (result.mode === 'approved') {
        setMessage('Your Persona identity check and safety review are already approved.')
        return result
      }
      if (result.mode === 'awaiting_admin') {
        setMessage('Your Persona identity check is complete and waiting for safety review.')
        return result
      }

      clientRef.current?.destroy()
      const { default: Persona } = await import('persona')
      const client = new Persona.Client({
        inquiryId: result.inquiryId,
        sessionToken: result.sessionToken,
        environmentId: result.environmentId,
        onReady: () => client.open(),
        onComplete: () => {
          setMessage('Identity check submitted. Keep this page open while the result is processed for admin review.')
        },
        onCancel: () => {
          setMessage('Identity verification was paused. You can continue when you are ready.')
        },
        onError: () => {
          setError('Persona could not load the identity check. Please close it and try again.')
        },
      })
      clientRef.current = client
      return result
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Identity verification could not be started.')
      return null
    } finally {
      setBusy(false)
    }
  }, [intent, startInquiry])

  return { begin, busy, message, error }
}
