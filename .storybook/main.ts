import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: [
    '../apps/web/src/**/*.stories.@(ts|tsx)',
    '../apps/admin/src/**/*.stories.@(ts|tsx)',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../apps/web/public'],
  docs: { defaultName: 'Documentation' },
}

export default config
