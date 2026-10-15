import { describe, expect, it } from 'vitest'

import { formatProbability, identitySignalLines } from '../../src/lib/identitySignals'

const healthy = {
  fullLegalNameLegible: 0.97,
  dateOfBirthLegible: 0.81,
  expirationDateLegible: 0.12,
  looksGenuine: 0.64,
  fullLegalNameMatches: 0.99,
  dateOfBirthMatches: 0.55,
  refusals: [] as string[],
}

describe('identity reviewer signal presentation', () => {
  it('renders every probability as a whole percentage', () => {
    expect(identitySignalLines(healthy)).toEqual([
      'Image read: name 97%, date of birth 81%, expiration date 12%',
      'Authenticity 64% · name match 99% · date of birth match 55%',
    ])
  })

  it('names a signal the reader did not answer instead of inventing a number', () => {
    const lines = identitySignalLines({ ...healthy, looksGenuine: undefined, fullLegalNameMatches: undefined })
    expect(lines[1]).toBe('Authenticity not answered · name match not answered · date of birth match 55%')
    expect(formatProbability(undefined)).toBe('not answered')
    expect(formatProbability(0)).toBe('0%')
    expect(formatProbability(1)).toBe('100%')
  })

  it('adds a line when the reader declined a question', () => {
    const lines = identitySignalLines({ ...healthy, refusals: ['looksGenuine', 'dateOfBirthLegible'] })
    expect(lines).toHaveLength(3)
    expect(lines[2]).toBe('The reader declined to answer: looksGenuine, dateOfBirthLegible.')
  })
})
