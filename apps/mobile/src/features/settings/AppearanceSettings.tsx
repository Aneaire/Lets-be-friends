import { useThemePreference } from '@/theme/ThemeProvider'

import { AppearanceSettingsPresentation } from './AppearanceSettingsPresentation'

export function AppearanceSettings() {
  const { state, setPreference, retry } = useThemePreference()

  return (
    <AppearanceSettingsPresentation
      state={state}
      onSelect={(preference) => void setPreference(preference)}
      onRetry={retry}
    />
  )
}
