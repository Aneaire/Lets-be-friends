import type { Preview } from '@storybook/react-vite'

import '../apps/web/src/styles.css'
import '../apps/admin/src/admin.css'
import '../apps/web/src/design-system/foundations/compact.css'

const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
    backgrounds: { disable: true },
    controls: { expanded: true },
    layout: 'centered',
    viewport: {
      options: {
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '800px' } },
        mobileSmall: { name: 'Mobile small', styles: { width: '320px', height: '700px' } },
        mobileDefault: { name: 'Mobile default', styles: { width: '390px', height: '844px' } },
        mobileLarge: { name: 'Mobile large', styles: { width: '430px', height: '932px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Application theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  initialGlobals: { viewport: 'desktop', theme: 'light' },
  decorators: [
    (Story, context) => {
      const dark = context.globals.theme === 'dark'
      const fullscreen = context.parameters.layout === 'fullscreen'
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      return (
        <div style={{ width: fullscreen ? '100%' : 'min(100%, 48rem)', minWidth: 0 }}>
          <Story />
        </div>
      )
    },
  ],
}

export default preview
