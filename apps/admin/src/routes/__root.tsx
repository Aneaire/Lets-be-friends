import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AdminGate } from '../features/admin-access/AdminShell'
import { AdminProviders } from '../features/platform/AdminProviders'
import appCss from '../../../web/src/styles.css?url'
import adminCss from '../admin.css?url'
import compactCss from '../../../web/src/design-system/foundations/compact.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: "Let's Be Friends Admin" },
      { name: 'description', content: "Safety review and moderation for Let's Be Friends." },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: adminCss },
      { rel: 'stylesheet', href: compactCss },
    ],
  }),
  shellComponent: RootDocument,
  component: RootApp,
})

function RootApp() {
  return (
    <AdminGate>
      <Outlet />
    </AdminGate>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeBootScript />
        <HeadContent />
      </head>
      <body>
        <AdminProviders>{children}</AdminProviders>
        {import.meta.env.DEV && <TanStackDevtools config={{ position: 'bottom-right' }} plugins={[{ name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> }]} />}
        <Scripts />
      </body>
    </html>
  )
}

function ThemeBootScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var key='lets-be-friends-theme';var saved=localStorage.getItem(key);var dark=saved==='dark'||(!saved&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.documentElement.dataset.theme=dark?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`,
      }}
    />
  )
}
