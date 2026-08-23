import type { StorybookConfig } from '@storybook/react-native-web-vite'
import { fileURLToPath } from 'node:url'

const ioniconsMock = fileURLToPath(new URL('./mocks/Ionicons.tsx', import.meta.url))

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
      resolve: {
        ...viteConfig.resolve,
        alias: Array.isArray(existingAlias)
          ? [ioniconsAlias, ...existingAlias]
          : { ...existingAlias, '@expo/vector-icons/Ionicons': ioniconsMock },
      },
    }
  },
}

export default config
