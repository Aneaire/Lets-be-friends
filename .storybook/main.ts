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
  staticDirs: [
    { from: '../apps/web/public', to: '/' },
    { from: '../apps/admin/public', to: '/admin-assets' },
  ],
  docs: { defaultName: 'Documentation' },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    optimizeDeps: {
      ...viteConfig.optimizeDeps,
      include: [
        ...(viteConfig.optimizeDeps?.include ?? []),
        '@tanstack/react-router',
      ],
    },
    resolve: {
      ...viteConfig.resolve,
      dedupe: [
        ...(viteConfig.resolve?.dedupe ?? []),
        'react',
        'react-dom',
      ],
    },
  }),
}

export default config
