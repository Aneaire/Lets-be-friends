import type { StorybookConfig } from '@storybook/react-native-web-vite'
import { fileURLToPath } from 'node:url'

const ioniconsMock = fileURLToPath(new URL('./mocks/Ionicons.tsx', import.meta.url))
const expoRouterMock = fileURLToPath(new URL('./mocks/expo-router.tsx', import.meta.url))

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {},
  },
  docs: { defaultName: 'Documentation' },
  viteFinal: async (viteConfig) => {
    const existingAlias = viteConfig.resolve?.alias
    const ioniconsAlias = { find: '@expo/vector-icons/Ionicons', replacement: ioniconsMock }

    return {
      ...viteConfig,
      optimizeDeps: {
        ...viteConfig.optimizeDeps,
        include: [
          ...(viteConfig.optimizeDeps?.include ?? []),
          '@react-native-community/netinfo',
          'react-native-safe-area-context',
          'react-native-toast-message',
        ],
      },
      resolve: {
        ...viteConfig.resolve,
        alias: Array.isArray(existingAlias)
          ? [ioniconsAlias, { find: 'expo-router', replacement: expoRouterMock }, ...existingAlias]
          : { ...existingAlias, '@expo/vector-icons/Ionicons': ioniconsMock, 'expo-router': expoRouterMock },
      },
    }
  },
}

export default config
