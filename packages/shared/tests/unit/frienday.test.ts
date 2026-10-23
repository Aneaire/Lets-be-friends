import { describe, expect, it } from 'vitest'
import {
  friendayCheckins,
  friendayNotAllowed,
  friendayPromise,
  friendaySafetyGroups,
  friendaySteps,
} from '../../src/frienday'

describe('shared Frienday guide', () => {
  it('keeps the full step-by-step guide available to both platforms', () => {
    expect(friendaySteps).toHaveLength(9)
    expect(friendaySteps[0].title).toBe('Set up your profile')
    expect(friendaySteps.at(-1)?.title).toBe('Leave an honest review')
    for (const step of friendaySteps) {
      expect(step.body.trim().length).toBeGreaterThan(0)
    }
  })

  it('keeps the optional check-in contract explicit', () => {
    expect(friendayCheckins.map((checkin) => checkin.title)).toEqual(['Start photo (Companion)', 'End photo (member)'])
    expect(friendayCheckins[0].purpose).toContain('explicitly skip')
    expect(friendayCheckins[1].purpose).toContain('no midpoint photo')
    expect(friendayCheckins.map((checkin) => checkin.purpose).join(' ')).not.toContain('camera requirement')
  })

  it('keeps safety, prohibited activity, and promise content non-empty', () => {
    expect(friendaySafetyGroups).toHaveLength(3)
    for (const group of friendaySafetyGroups) {
      expect(group.items.length).toBeGreaterThan(0)
    }
    expect(friendayNotAllowed.length).toBeGreaterThan(5)
    expect(friendayPromise.length).toBeGreaterThan(5)
  })

  it('does not contain user-facing em dashes', () => {
    const copy = [
      ...friendaySteps.flatMap((step) => [step.title, step.body]),
      ...friendayCheckins.flatMap((checkin) => [checkin.title, checkin.purpose]),
      ...friendaySafetyGroups.flatMap((group) => [group.title, ...group.items]),
      ...friendayNotAllowed,
      ...friendayPromise,
    ].join('\n')
    expect(copy).not.toContain('—')
  })
})
