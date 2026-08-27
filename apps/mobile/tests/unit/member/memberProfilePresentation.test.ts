import { memberSafetyDisclosure } from '@/member/memberProfilePresentation'

describe('member profile safety disclosure', () => {
  it('describes the hidden safety actions before the section is opened', () => {
    expect(memberSafetyDisclosure(false)).toEqual({
      label: 'Safety and privacy',
      hint: 'Show report, mute, and block actions',
      icon: 'chevron-down',
    })
  })

  it('announces how to close the expanded safety section', () => {
    expect(memberSafetyDisclosure(true)).toEqual({
      label: 'Safety and privacy',
      hint: 'Hide safety actions',
      icon: 'chevron-up',
    })
  })
})
