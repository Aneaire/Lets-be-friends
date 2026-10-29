import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { modalSurfaceAccessibility } from '@/design-system/molecules/ModalPresentation'

const modalSource = readFileSync(join(process.cwd(), 'src/design-system/molecules/ModalPresentation.tsx'), 'utf8')

describe('modal presentation accessibility contract', () => {
  it('exposes a labelled dialog landmark for every modal overlay', () => {
    expect(modalSurfaceAccessibility({
      titleId: 'title-1',
      hasDescription: false,
      descriptionId: 'description-1',
      busy: false,
    })).toEqual({
      role: 'dialog',
      'aria-labelledby': 'title-1',
      'aria-describedby': undefined,
      'aria-busy': undefined,
    })
  })

  it('links the description and busy state without inventing empty attributes', () => {
    expect(modalSurfaceAccessibility({
      titleId: 'title-2',
      hasDescription: true,
      descriptionId: 'description-2',
      busy: true,
    })).toEqual({
      role: 'dialog',
      'aria-labelledby': 'title-2',
      'aria-describedby': 'description-2',
      'aria-busy': true,
    })
  })
})

describe('bottom sheet header spacing', () => {
  it('tightens the gap above a title-only option list', () => {
    expect(modalSource).toContain('const singleLineSheetHeader = isBottomSheet && !description')
    expect(modalSource).toContain('singleLineSheetHeader && styles.bottomSheetHeaderTight')
    expect(modalSource).toContain("bottomSheetHeaderTight: { alignItems: 'center', paddingBottom: density.textStackGap }")
  })
})
