import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const companionRoute = readFileSync(fileURLToPath(new URL('../../src/routes/companion.tsx', import.meta.url)), 'utf8')
const becomeCompanionRoute = readFileSync(fileURLToPath(new URL('../../src/routes/become-companion.tsx', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('../../src/styles.css', import.meta.url)), 'utf8')

describe('owner availability route integration', () => {
  it('saves the Companion schedule from the Companion workspace below profile status', () => {
    expect(companionRoute).toContain("import { WeeklyAvailabilityEditor } from '../features/scheduling/WeeklyAvailabilityEditor'")
    expect(companionRoute).toContain('useMutation(api.companions.updateAvailability)')
    expect(companionRoute).toContain('id="availability"')
    expect(companionRoute).toContain('initialAvailability={application.weeklyAvailability}')
    expect(companionRoute).toContain('await updateAvailability({ weeklyAvailability })')
    expect(companionRoute.indexOf('id="profile"')).toBeLessThan(companionRoute.indexOf('id="availability"'))
  })

  it('lets an existing Companion configure availability from the profile editor outside the profile form', () => {
    expect(becomeCompanionRoute).toContain("import { WeeklyAvailabilityEditor } from '../features/scheduling/WeeklyAvailabilityEditor'")
    expect(becomeCompanionRoute).toContain('useMutation(api.companions.updateAvailability)')
    expect(becomeCompanionRoute).toContain('initialAvailability={application.weeklyAvailability}')
    expect(becomeCompanionRoute).toContain('id="companion-availability"')
    expect(becomeCompanionRoute.indexOf('</form>')).toBeLessThan(becomeCompanionRoute.indexOf('className="companion-availability-panel"'))
    expect(becomeCompanionRoute).toContain('await updateAvailability({ weeklyAvailability })')
  })

  it('links the saved-profile success state to availability settings', () => {
    expect(becomeCompanionRoute).toContain('to="/companion" hash="availability"')
    expect(becomeCompanionRoute).toContain('Set your availability')
  })

  it('styles the scheduling surfaces with semantic tokens only', () => {
    const start = styles.indexOf('Scheduling: Companion weekly availability and booking starts')
    const schedulingStyles = styles.slice(start)
    expect(start).toBeGreaterThan(-1)
    expect(schedulingStyles).toContain('.availability-calendar')
    expect(schedulingStyles).toContain('.weekly-availability-editor')
    expect(schedulingStyles).toContain('var(--accent-social-control)')
    expect(schedulingStyles).toContain('var(--accent-self-control)')
    expect(schedulingStyles).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(schedulingStyles).not.toContain('—')
    expect(schedulingStyles).not.toContain('gradient(')
  })
})
