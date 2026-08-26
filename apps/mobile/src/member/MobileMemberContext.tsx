import { createContext, type PropsWithChildren, useContext } from 'react'

import type { MobileMemberState } from './MobileMember'

const MobileMemberContext = createContext<MobileMemberState>({ status: 'unconfigured' })

export function MobileMemberStateProvider({ value, children }: PropsWithChildren<{ value: MobileMemberState }>) {
  return <MobileMemberContext.Provider value={value}>{children}</MobileMemberContext.Provider>
}

export function useMobileMember() {
  return useContext(MobileMemberContext)
}
