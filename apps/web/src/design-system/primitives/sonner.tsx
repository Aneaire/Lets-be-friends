import { Toaster as Sonner } from 'sonner'
import { useThemeChoice } from '../atoms/ThemeToggle'

export function Toaster() {
  const { theme } = useThemeChoice()
  return (
    <Sonner
      theme={theme}
      position="top-right"
      offset={72}
      closeButton
      toastOptions={{
        classNames: {
          toast: 'app-toast',
          title: 'app-toast-title',
          description: 'app-toast-description',
          closeButton: 'app-toast-close',
        },
      }}
    />
  )
}
