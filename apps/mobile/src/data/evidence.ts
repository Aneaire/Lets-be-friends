export type EvidenceDecision = 'uploaded' | 'skipped' | undefined

export function evidenceDecisionCopy(role: 'host_start' | 'member_end', decision: EvidenceDecision) {
  const label = role === 'host_start' ? 'Start evidence' : 'End evidence'
  if (decision === 'uploaded') return { label, detail: 'Private image saved in the web app.' }
  if (decision === 'skipped') return { label, detail: 'Skipped after the strict warning was acknowledged.' }
  return { label, detail: 'Choose private image evidence in the web app or explicitly skip it.' }
}
