import type { Preview } from '@storybook/react-native-web-vite'
import { View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AppThemeProvider } from '../src/theme/ThemeProvider'
import { resolveTheme, type ColorScheme } from '../src/theme/tokens'

const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
    backgrounds: { disable: true },
    controls: { expanded: true },
    layout: 'fullscreen',
    viewport: {
      options: {
        mobileSmall: { name: 'Mobile small', styles: { width: '320px', height: '700px' } },
        mobileDefault: { name: 'Mobile default', styles: { width: '390px', height: '844px' } },
        mobileLarge: { name: 'Mobile large', styles: { width: '430px', height: '932px' } },
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Application theme',
      defaultValue: 'light',
      toolbar: { icon: 'paintbrush', items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }] },
    },
  },
  initialGlobals: { viewport: 'mobileDefault', theme: 'light' },
  decorators: [
    (Story, context) => {
      const scheme: ColorScheme = context.globals.theme === 'dark' ? 'dark' : 'light'
      const theme = resolveTheme(scheme)
      const canvasPadding = context.parameters.mobileCanvasPadding ?? 16

      return (
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 24, right: 0, bottom: 24, left: 0 },
          }}>
          <AppThemeProvider scheme={scheme}>
            <View
              style={{
                flex: 1,
                minHeight: '100vh' as never,
                padding: canvasPadding,
                backgroundColor: theme.colors.background,
              }}>
              <Story />
            </View>
          </AppThemeProvider>
        </SafeAreaProvider>
      )
    },
  ],
}

export default preview
